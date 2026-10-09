import express, { type RequestHandler } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getPrisma, resolveDatabaseUrl, withDatabaseRetry } from './db.js';
import {
  createSessionToken,
  getSessionTokenFromCookieHeader,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifySessionToken,
} from './auth.js';
import { createTransactionRouter } from './transactions.js';
import { requirePermission, type AuthenticatedUser } from './access.js';
import { createAdminRouter } from './admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const uploadDir = process.env.UPLOAD_DIRECTORY
  ? path.resolve(process.env.UPLOAD_DIRECTORY)
  : process.env.VERCEL
    ? '/tmp/school-finance-uploads'
    : path.resolve(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.APP_ORIGIN ?? 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.mimetype)) {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    cb(null, true);
  },
});

export const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET ?? '';
    const token = getSessionTokenFromCookieHeader(req.headers.cookie);
    const claims = token ? verifySessionToken(token, secret) : null;
    if (!claims) {
      res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      res.status(401).json({ message: 'Please sign in to continue.' });
      return;
    }

    const session = await withDatabaseRetry(() => getPrisma().session.findUnique({
      where: { tokenId: claims.sessionId },
      include: { user: { include: {
        role: { include: { grants: { include: { permission: { select: { key: true } } } } } },
        permissionOverrides: { include: { permission: { select: { key: true } } } },
      } } },
    }));
    const user = session?.user;
    if (!session || session.userId !== claims.userId || session.revokedAt || session.expiresAt <= new Date() || !user || user.status !== 'active') {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' });
      return;
    }
    if (user.role.status !== 'active' && !user.isSuperAdmin) {
      res.status(403).json({ message: 'Your assigned role is inactive. Contact a Super Admin.' });
      return;
    }
    if (user.role.name === 'Super Admin' && !user.isSuperAdmin) {
      res.status(403).json({ message: 'This account is not the protected system owner.' });
      return;
    }
    const effectivePermissions = new Set(user.role.grants.map((grant) => grant.permission.key));
    for (const override of user.permissionOverrides) {
      if (override.granted) effectivePermissions.add(override.permission.key);
      else effectivePermissions.delete(override.permission.key);
    }
    const permissions = user.isSuperAdmin
      ? await getPrisma().permission.findMany({ select: { key: true } }).then((rows) => rows.map((row) => row.key))
      : [...effectivePermissions];
    res.locals.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
      accessLevel: user.role.accessLevel,
      isSuperAdmin: user.isSuperAdmin,
      permissions,
    } satisfies AuthenticatedUser;
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      void getPrisma().session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    }
    next();
  } catch (error) {
    next(error);
  }
};

function loginThrottleKeys(email: string, ip: string, secret: string): string[] {
  return [`email:${email}`, `ip:${ip}`].map((value) => createHmac('sha256', secret).update(value).digest('hex'));
}

async function isLoginThrottled(keys: string[]): Promise<boolean> {
  return Boolean(await getPrisma().loginThrottle.findFirst({ where: { keyHash: { in: keys }, blockedUntil: { gt: new Date() } }, select: { keyHash: true } }));
}

async function recordFailedLogin(keys: string[]): Promise<void> {
  const prisma = getPrisma();
  await Promise.all(keys.map((keyHash) => prisma.$executeRaw`
    INSERT INTO "LoginThrottle" ("keyHash", "windowStartedAt", "attempts", "blockedUntil", "updatedAt")
    VALUES (${keyHash}, NOW(), 1, NULL, NOW())
    ON CONFLICT ("keyHash") DO UPDATE SET
      "attempts" = CASE WHEN "LoginThrottle"."windowStartedAt" <= NOW() - INTERVAL '15 minutes' THEN 1 ELSE "LoginThrottle"."attempts" + 1 END,
      "windowStartedAt" = CASE WHEN "LoginThrottle"."windowStartedAt" <= NOW() - INTERVAL '15 minutes' THEN NOW() ELSE "LoginThrottle"."windowStartedAt" END,
      "blockedUntil" = CASE WHEN "LoginThrottle"."windowStartedAt" <= NOW() - INTERVAL '15 minutes' THEN NULL WHEN "LoginThrottle"."attempts" + 1 >= 10 THEN NOW() + INTERVAL '15 minutes' ELSE "LoginThrottle"."blockedUntil" END,
      "updatedAt" = NOW()
  `));
}

app.use('/api/transactions', createTransactionRouter(requireSession, requirePermission));
app.use('/api/admin', createAdminRouter(requireSession, requirePermission));

app.get('/uploads/:fileName', requireSession, requirePermission('transactions.view'), (req, res, next) => {
  const fileName = typeof req.params.fileName === 'string' ? req.params.fileName : '';
  if (!/^[0-9a-f-]{36}\.(pdf|jpg|png)$/i.test(fileName)) {
    res.status(404).end();
    return;
  }

  res.setHeader('Cache-Control', 'private, no-store');
  res.sendFile(path.join(uploadDir, fileName), (error) => {
    if (error) next(error);
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'School finance API is running' });
});

app.get('/api/health/ready', async (_req, res) => {
  try {
    await withDatabaseRetry(() => getPrisma().$queryRaw`SELECT 1`);
    res.json({ ok: true, database: 'ready' });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password || email.length > 254 || Buffer.byteLength(password, 'utf8') > 72) {
      res.status(400).json({ message: 'Enter a valid email address and a password of no more than 72 UTF-8 bytes.' });
      return;
    }

    let databaseConfigured = true;
    try {
      resolveDatabaseUrl();
    } catch {
      databaseConfigured = false;
    }
    if (!databaseConfigured || (process.env.JWT_SECRET ?? '').length < 32) {
      res.status(503).json({ message: 'Sign-in is temporarily unavailable because server security settings are incomplete.' });
      return;
    }
    const throttleKeys = loginThrottleKeys(email, req.ip ?? 'unknown', process.env.JWT_SECRET ?? '');
    if (await isLoginThrottled(throttleKeys)) {
      await getPrisma().auditLog.create({ data: { action: 'LOGIN_THROTTLED', entity: 'Authentication', outcome: 'DENIED', ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 500) } });
      res.status(429).json({ message: 'Too many sign-in attempts. Try again in 15 minutes.' });
      return;
    }

    const user = await withDatabaseRetry(() => getPrisma().user.findUnique({
      where: { email },
      include: { role: { include: { grants: { include: { permission: { select: { key: true } } } } } }, permissionOverrides: { include: { permission: { select: { key: true } } } } },
    }));

    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches || user.status !== 'active' || user.role.status !== 'active' || (user.role.name === 'Super Admin' && !user.isSuperAdmin)) {
      await recordFailedLogin(throttleKeys);
      await getPrisma().auditLog.create({ data: { action: 'LOGIN_FAILED', entity: 'Authentication', outcome: 'DENIED', ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 500) } });
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }
    await getPrisma().loginThrottle.deleteMany({ where: { keyHash: { in: throttleKeys } } });

    const tokenId = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
    const session = await getPrisma().session.create({ data: {
      tokenId,
      userId: user.id,
      expiresAt,
      ipAddress: req.ip,
      device: req.get('user-agent')?.slice(0, 500),
    } });

    await getPrisma().auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        device: req.get('user-agent')?.slice(0, 500),
      },
    });

    const secret = process.env.JWT_SECRET ?? '';
    const token = createSessionToken(user.id, user.role.name, secret, SESSION_DURATION_SECONDS, session.tokenId);
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS * 1000,
      path: '/',
    });

    const effectivePermissions = new Set(user.role.grants.map((grant) => grant.permission.key));
    for (const override of user.permissionOverrides) {
      if (override.granted) effectivePermissions.add(override.permission.key);
      else effectivePermissions.delete(override.permission.key);
    }
    const permissions = user.isSuperAdmin
      ? await getPrisma().permission.findMany({ select: { key: true } }).then((rows) => rows.map((row) => row.key))
      : [...effectivePermissions];
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name, isSuperAdmin: user.isSuperAdmin, permissions },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireSession, (_req, res) => {
  res.json({ user: res.locals.authUser });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = getSessionTokenFromCookieHeader(req.headers.cookie);
  const claims = token ? verifySessionToken(token, process.env.JWT_SECRET ?? '') : null;
  res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

  if (claims) {
    try {
      await getPrisma().$transaction(async (tx) => {
        await tx.session.updateMany({ where: { tokenId: claims.sessionId, userId: claims.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.auditLog.create({ data: {
          userId: claims.userId,
          action: 'LOGOUT',
          entity: 'User',
          entityId: claims.userId,
          ipAddress: req.ip,
          device: req.get('user-agent')?.slice(0, 500),
        } });
      });
    } catch (error) {
      console.error('Logout audit event could not be saved:', error);
    }
  }

  res.status(204).end();
});

app.post('/api/auth/password-reset', async (req, res, next) => {
  try {
    const resetToken = typeof req.body?.token === 'string' ? req.body.token : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (resetToken.length < 32 || resetToken.length > 200 || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      res.status(400).json({ message: 'A valid reset token and a password between 12 and 72 UTF-8 bytes are required.' });
      return;
    }
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await getPrisma().$transaction(async (tx) => {
      const reset = await tx.passwordReset.findUnique({ where: { tokenHash } });
      if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return false;
      const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) return false;
      await tx.user.update({ where: { id: reset.userId }, data: { passwordHash } });
      await tx.session.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: reset.userId, action: 'PASSWORD_RESET_COMPLETED', entity: 'User', entityId: reset.userId, ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 500) } });
      return true;
    });
    if (!result) {
      res.status(400).json({ message: 'The reset token is invalid or expired.' });
      return;
    }
    res.json({ message: 'Password changed. Please sign in again.' });
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', requireSession, requirePermission('dashboard.view'), async (_req, res, next) => {
  try {
    const prisma = getPrisma();
    const [income, expenditure, transactionCount] = await withDatabaseRetry(() => Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'INCOME', status: 'approved' },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'EXPENDITURE', status: 'approved' },
      }),
      prisma.transaction.count({ where: { status: 'approved' } }),
    ]));

    const totalIncome = Number(income._sum.amount ?? 0);
    const totalExpenditure = Number(expenditure._sum.amount ?? 0);

    res.json({
      summary: {
        totalIncome,
        totalExpenditure,
        currentBalance: totalIncome - totalExpenditure,
        transactionCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/upload', requireSession, requirePermission('transactions.create'), (req, res, next) => {
  if (process.env.VERCEL) {
    res.status(503).json({ message: 'File uploads are unavailable until persistent object storage is configured.' });
    return;
  }
  next();
}, upload.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ message: 'Choose a PDF, JPG or PNG file smaller than 5 MB.' });
    return;
  }

  const { buffer, mimetype, originalname } = req.file;
  const signatureMatches =
    (mimetype === 'application/pdf' && buffer.subarray(0, 5).toString('ascii') === '%PDF-') ||
    ((mimetype === 'image/jpeg' || mimetype === 'image/jpg') && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (mimetype === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])));

  if (!signatureMatches) {
    res.status(400).json({ message: 'The file contents do not match a supported PDF, JPG or PNG file.' });
    return;
  }

  const extension = mimetype === 'application/pdf' ? 'pdf' : mimetype === 'image/png' ? 'png' : 'jpg';
  const fileName = `${randomUUID()}.${extension}`;
  try {
    await fs.promises.writeFile(path.join(uploadDir, fileName), buffer, { flag: 'wx' });
    res.json({ fileName, originalName: originalname, path: `/uploads/${fileName}` });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError) {
    const isTooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(isTooLarge ? 413 : 400).json({
      message: isTooLarge
        ? 'Choose a PDF, JPG or PNG file smaller than 5 MB.'
        : 'Choose a PDF, JPG or PNG file.',
    });
    return;
  }

  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : 500;
  if (status === 400) {
    res.status(400).json({ message: 'The request body is invalid.' });
    return;
  }
  if (status === 413) {
    res.status(413).json({ message: 'The request is too large.' });
    return;
  }

  console.error('API request failed:', error);
  res.status(500).json({ message: 'The request could not be completed. Please try again.' });
});

export default app;
