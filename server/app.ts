import express, { type RequestHandler } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getPrisma } from './db.js';
import {
  createSessionToken,
  getSessionTokenFromCookieHeader,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  verifySessionToken,
} from './auth.js';

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
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    cb(null, allowed.includes(file.mimetype));
  },
});

const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const secret = process.env.JWT_SECRET ?? '';
    const token = getSessionTokenFromCookieHeader(req.headers.cookie);
    const claims = token ? verifySessionToken(token, secret) : null;
    if (!claims) {
      res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      res.status(401).json({ message: 'Please sign in to continue.' });
      return;
    }

    const user = await getPrisma().user.findUnique({
      where: { id: claims.userId },
      include: { role: true },
    });

    if (!user || user.status !== 'active') {
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' });
      return;
    }

    res.locals.authUser = { id: user.id, name: user.name, email: user.email, role: user.role.name };
    next();
  } catch (error) {
    next(error);
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, message: 'School finance system is running' });
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!email || !password || email.length > 254 || password.length > 256) {
      res.status(400).json({ message: 'Enter a valid email address and password.' });
      return;
    }

    if (!process.env.DATABASE_URL || (process.env.JWT_SECRET ?? '').length < 32) {
      res.status(503).json({ message: 'Sign-in is temporarily unavailable because server security settings are incomplete.' });
      return;
    }

    const user = await getPrisma().user.findUnique({
      where: { email },
      include: { role: true },
    });

    const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordMatches || user.status !== 'active') {
      res.status(401).json({ message: 'Email or password is incorrect.' });
      return;
    }

    const secret = process.env.JWT_SECRET ?? '';
    const token = createSessionToken(user.id, user.role.name, secret);
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_SECONDS * 1000,
      path: '/',
    });

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

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role.name },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/me', requireSession, (_req, res) => {
  res.json({ user: res.locals.authUser });
});

app.post('/api/auth/logout', requireSession, async (req, res, next) => {
  try {
    const user = res.locals.authUser as { id: string };
    await getPrisma().auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGOUT',
        entity: 'User',
        entityId: user.id,
        ipAddress: req.ip,
        device: req.get('user-agent')?.slice(0, 500),
      },
    });
    res.clearCookie(SESSION_COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', requireSession, async (_req, res, next) => {
  try {
    const prisma = getPrisma();
    const [income, expenditure, transactionCount] = await Promise.all([
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'INCOME', status: { not: 'VOIDED' } },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'EXPENDITURE', status: { not: 'VOIDED' } },
      }),
      prisma.transaction.count({ where: { status: { not: 'VOIDED' } } }),
    ]);

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

app.post('/api/upload', requireSession, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'Choose a PDF, JPG or PNG file smaller than 5 MB.' });
    return;
  }

  res.json({
    fileName: req.file.filename,
    originalName: req.file.originalname,
    path: `/uploads/${req.file.filename}`,
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API request failed:', error);
  res.status(500).json({ message: 'The request could not be completed. Please try again.' });
});

export default app;