import express, { type RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from './db.js';
import { canGrantPermissions, canManageAccessLevel, type AuthenticatedUser } from './access.js';
import { SUPER_ADMIN_ROLE } from './roles.js';

class AdminError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const endpoint = (handler: (req: express.Request, res: express.Response) => Promise<void>): RequestHandler => (req, res, next) => {
  void handler(req, res).catch((error: unknown) => {
    if (error instanceof AdminError) {
      const actor = res.locals.authUser as AuthenticatedUser | undefined;
      if (actor && (error.status === 403 || error.status === 409)) {
        void getPrisma().auditLog.create({ data: {
          userId: actor.id, action: 'ADMIN_ACTION_DENIED', entity: req.baseUrl + req.path,
          entityId: req.params.id || null, outcome: 'DENIED', ipAddress: req.ip,
          device: req.get('user-agent')?.slice(0, 500),
        } }).catch((auditError: unknown) => console.error('Denied administrative action audit could not be saved:', auditError));
      }
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  });
};

const actorOf = (res: express.Response): AuthenticatedUser => {
  const actor = res.locals.authUser as AuthenticatedUser | undefined;
  if (!actor) throw new AdminError(401, 'Please sign in to continue.');
  return actor;
};

const objectBody = (body: unknown): Record<string, unknown> => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AdminError(400, 'A JSON object is required.');
  return body as Record<string, unknown>;
};

function rejectUnknown(body: Record<string, unknown>, fields: readonly string[]): void {
  const unknown = Object.keys(body).find((key) => !fields.includes(key));
  if (unknown) throw new AdminError(400, `The ${unknown} field is not accepted.`);
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new AdminError(400, `${field} is required and must be at most ${max} characters.`);
  return value.trim();
}

function pagination(query: express.Request['query']) {
  const page = Number(query.page ?? '1');
  const pageSize = Number(query.pageSize ?? '25');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new AdminError(400, 'page must be positive and pageSize must be between 1 and 100.');
  }
  return { page, pageSize, skip: (page - 1) * pageSize };
}

async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  oldValue: unknown,
  newValue: unknown,
  req: express.Request,
  outcome = 'SUCCESS',
) {
  await tx.auditLog.create({ data: {
    userId: actorId, action, entity, entityId,
    previousValue: oldValue === null ? null : JSON.stringify(oldValue),
    newValue: newValue === null ? null : JSON.stringify(newValue),
    outcome, ipAddress: req.ip, device: req.get('user-agent')?.slice(0, 500),
  } });
}

async function resolvePermissions(keys: unknown, actor: AuthenticatedUser) {
  if (!Array.isArray(keys) || keys.some((key) => typeof key !== 'string') || new Set(keys).size !== keys.length) {
    throw new AdminError(400, 'permissions must be an array of unique permission keys.');
  }
  const permissionKeys = keys as string[];
  const records = await getPrisma().permission.findMany({ where: { key: { in: permissionKeys } }, select: { id: true, key: true } });
  if (records.length !== permissionKeys.length) throw new AdminError(400, 'One or more permission keys are unknown.');
  if (!canGrantPermissions(actor, permissionKeys)) throw new AdminError(403, 'You cannot grant permissions you do not hold.');
  return records;
}

async function scopedRole(roleId: string, actor: AuthenticatedUser, allowSystem = false) {
  const role = await getPrisma().role.findUnique({ where: { id: roleId }, include: { grants: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } } });
  if (!role || role.status !== 'active') throw new AdminError(400, 'The selected role is unavailable.');
  if (!canManageAccessLevel(actor, role.accessLevel) && !actor.isSuperAdmin) throw new AdminError(403, 'You cannot manage a role at or above your access level.');
  if (!allowSystem && role.isSystem) throw new AdminError(403, 'System roles are protected.');
  if (role.name === SUPER_ADMIN_ROLE) throw new AdminError(403, 'The Super Admin role cannot be assigned or modified through this operation.');
  if (!canGrantPermissions(actor, role.grants.map((grant) => grant.permission.key))) throw new AdminError(403, 'You cannot assign users to a role containing permissions you do not hold.');
  return role;
}

async function scopedUser(userId: string, actor: AuthenticatedUser) {
  const target = await getPrisma().user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) throw new AdminError(404, 'User not found.');
  if (target.isSuperAdmin || target.role.name === SUPER_ADMIN_ROLE) throw new AdminError(403, 'The Super Admin account is protected.');
  if (target.id === actor.id) throw new AdminError(403, 'Use profile settings to change your own account.');
  if (!canManageAccessLevel(actor, target.role.accessLevel)) throw new AdminError(403, 'You cannot manage a user at or above your access level.');
  return target;
}

export function createAdminRouter(requireSession: RequestHandler, requirePermission: (permission: string) => RequestHandler) {
  const router = express.Router();
  router.use(requireSession);

  router.get('/overview', requirePermission('users.view'), endpoint(async (_req, res) => {
    const prisma = getPrisma();
    const [totalUsers, activeUsers, suspendedUsers, totalRoles, recentActions] = await Promise.all([
      prisma.user.count(), prisma.user.count({ where: { status: 'active' } }), prisma.user.count({ where: { status: { in: ['suspended', 'inactive'] } } }),
      prisma.role.count({ where: { status: 'active' } }),
      (actorOf(res).isSuperAdmin || actorOf(res).permissions.includes('audit_logs.view'))
        ? prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { action: true, entity: true, entityId: true, outcome: true, createdAt: true } })
        : Promise.resolve([]),
    ]);
    res.json({ overview: { totalUsers, activeUsers, suspendedUsers, totalRoles, recentActions } });
  }));

  router.get('/permissions', requirePermission('roles.view'), endpoint(async (_req, res) => {
    const permissions = await getPrisma().permission.findMany({ orderBy: [{ module: 'asc' }, { key: 'asc' }] });
    res.json({ permissions });
  }));

  router.get('/accounts', requirePermission('accounts.view'), endpoint(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { bankName: { contains: search, mode: 'insensitive' as const } }] } : {};
    const prisma = getPrisma();
    const [rows, total] = await Promise.all([
      prisma.account.findMany({ where, select: { id: true, name: true, type: true, bankName: true, accountNumber: true, openingBalance: true, currentBalance: true, status: true, notes: true, createdAt: true, updatedAt: true }, orderBy: { name: 'asc' }, skip, take: pageSize }),
      prisma.account.count({ where }),
    ]);
    const accounts = rows.map((account) => ({ ...account, accountNumber: account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : null }));
    res.json({ accounts, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  router.post('/accounts', requirePermission('accounts.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'type', 'bankName', 'accountNumber', 'openingBalance', 'notes']);
    const name = text(body.name, 'name', 120);
    const type = text(body.type, 'type', 30).toUpperCase();
    if (!['BANK', 'CASH', 'PETTY_CASH'].includes(type)) throw new AdminError(400, 'type must be BANK, CASH, or PETTY_CASH.');
    const openingBalance = body.openingBalance === undefined ? new Prisma.Decimal(0) : typeof body.openingBalance === 'string' && /^\d{1,15}(?:\.\d{1,2})?$/.test(body.openingBalance) ? new Prisma.Decimal(body.openingBalance) : (() => { throw new AdminError(400, 'openingBalance must be a non-negative decimal string with at most two decimal places.'); })();
    const bankName = body.bankName === undefined ? null : text(body.bankName, 'bankName', 120);
    const accountNumber = body.accountNumber === undefined ? null : text(body.accountNumber, 'accountNumber', 80);
    const notes = body.notes === undefined ? null : text(body.notes, 'notes', 1000);
    const account = await getPrisma().$transaction(async (tx) => {
      const created = await tx.account.create({ data: { name, type, bankName, accountNumber, openingBalance, currentBalance: openingBalance, status: 'active', notes } });
      await audit(tx, actor.id, 'ACCOUNT_CREATED', 'Account', created.id, null, { ...created, accountNumber: accountNumber ? '[REDACTED]' : null }, req);
      return created;
    });
    res.status(201).json({ account: { ...account, accountNumber: account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : null } });
  }));

  router.patch('/accounts/:id', requirePermission('accounts.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'bankName', 'accountNumber', 'notes', 'status']);
    if (!Object.keys(body).length) throw new AdminError(400, 'Provide account fields to update.');
    const before = await getPrisma().account.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AdminError(404, 'Account not found.');
    const data: Prisma.AccountUpdateInput = {
      ...(body.name === undefined ? {} : { name: text(body.name, 'name', 120) }),
      ...(body.bankName === undefined ? {} : { bankName: body.bankName === null || body.bankName === '' ? null : text(body.bankName, 'bankName', 120) }),
      ...(body.accountNumber === undefined ? {} : { accountNumber: body.accountNumber === null || body.accountNumber === '' ? null : text(body.accountNumber, 'accountNumber', 80) }),
      ...(body.notes === undefined ? {} : { notes: body.notes === null || body.notes === '' ? null : text(body.notes, 'notes', 1000) }),
      ...(body.status === undefined ? {} : { status: body.status as string }),
    };
    if (data.status !== undefined && data.status !== 'active' && data.status !== 'inactive') throw new AdminError(400, 'status must be active or inactive.');
    if (data.status === 'inactive' && await getPrisma().transaction.count({ where: { accountId: before.id, status: { in: ['pending', 'approved'] } } })) throw new AdminError(409, 'This account has pending or approved transactions and cannot be deactivated.');
    const account = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.account.update({ where: { id: before.id }, data });
      await audit(tx, actor.id, 'ACCOUNT_UPDATED', 'Account', before.id, { ...before, accountNumber: before.accountNumber ? '[REDACTED]' : null }, { ...updated, accountNumber: updated.accountNumber ? '[REDACTED]' : null }, req);
      return updated;
    });
    res.json({ account: { ...account, accountNumber: account.accountNumber ? `••••${account.accountNumber.slice(-4)}` : null } });
  }));

  router.get('/categories', requirePermission('categories.view'), endpoint(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const where = { ...(req.query.type === 'INCOME' || req.query.type === 'EXPENDITURE' ? { type: req.query.type } : {}), ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}) };
    const [categories, total] = await Promise.all([getPrisma().category.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize }), getPrisma().category.count({ where })]);
    res.json({ categories, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  router.post('/categories', requirePermission('categories.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'type', 'description']);
    const name = text(body.name, 'name', 120);
    if (body.type !== 'INCOME' && body.type !== 'EXPENDITURE') throw new AdminError(400, 'type must be INCOME or EXPENDITURE.');
    const type = body.type;
    const description = body.description === undefined ? null : text(body.description, 'description', 500);
    const category = await getPrisma().$transaction(async (tx) => {
      const created = await tx.category.create({ data: { name, type, description, status: 'active' } });
      await audit(tx, actor.id, 'CATEGORY_CREATED', 'Category', created.id, null, created, req);
      return created;
    });
    res.status(201).json({ category });
  }));

  router.patch('/categories/:id', requirePermission('categories.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'description', 'status']);
    if (!Object.keys(body).length) throw new AdminError(400, 'Provide category fields to update.');
    const before = await getPrisma().category.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AdminError(404, 'Category not found.');
    if (body.status !== undefined && body.status !== 'active' && body.status !== 'inactive') throw new AdminError(400, 'status must be active or inactive.');
    const data = { ...(body.name === undefined ? {} : { name: text(body.name, 'name', 120) }), ...(body.description === undefined ? {} : { description: body.description === null || body.description === '' ? null : text(body.description, 'description', 500) }), ...(body.status === undefined ? {} : { status: body.status }) };
    const category = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id: before.id }, data });
      await audit(tx, actor.id, 'CATEGORY_UPDATED', 'Category', before.id, before, updated, req);
      return updated;
    });
    res.json({ category });
  }));

  router.get('/payment-methods', requirePermission('payment_methods.view'), endpoint(async (_req, res) => {
    const paymentMethods = await getPrisma().paymentMethod.findMany({ orderBy: { name: 'asc' } });
    res.json({ paymentMethods });
  }));

  router.post('/payment-methods', requirePermission('payment_methods.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body); rejectUnknown(body, ['name']);
    const name = text(body.name, 'name', 80);
    const paymentMethod = await getPrisma().$transaction(async (tx) => {
      const created = await tx.paymentMethod.create({ data: { name, status: 'active' } });
      await audit(tx, actor.id, 'PAYMENT_METHOD_CREATED', 'PaymentMethod', created.id, null, created, req);
      return created;
    });
    res.status(201).json({ paymentMethod });
  }));

  router.patch('/payment-methods/:id', requirePermission('payment_methods.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res); const body = objectBody(req.body); rejectUnknown(body, ['name', 'status']);
    if (!Object.keys(body).length) throw new AdminError(400, 'Provide payment method fields to update.');
    const before = await getPrisma().paymentMethod.findUnique({ where: { id: req.params.id } });
    if (!before) throw new AdminError(404, 'Payment method not found.');
    if (body.status !== undefined && body.status !== 'active' && body.status !== 'inactive') throw new AdminError(400, 'status must be active or inactive.');
    if (body.status === 'inactive' && await getPrisma().transaction.count({ where: { paymentMethodId: before.id, status: { in: ['pending', 'approved'] } } })) throw new AdminError(409, 'This payment method is used by pending or approved transactions.');
    const data: Prisma.PaymentMethodUpdateInput = { ...(body.name === undefined ? {} : { name: text(body.name, 'name', 80) }), ...(body.status === undefined ? {} : { status: body.status as string }) };
    const paymentMethod = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.paymentMethod.update({ where: { id: before.id }, data });
      await audit(tx, actor.id, 'PAYMENT_METHOD_UPDATED', 'PaymentMethod', before.id, before, updated, req);
      return updated;
    });
    res.json({ paymentMethod });
  }));

  router.get('/roles', requirePermission('roles.view'), endpoint(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const requestedStatus = req.query.status;
    if (requestedStatus !== undefined && (typeof requestedStatus !== 'string' || !['active', 'inactive', 'all'].includes(requestedStatus))) throw new AdminError(400, 'Invalid role status filter.');
    const where = {
      ...(requestedStatus === 'all' ? {} : { status: typeof requestedStatus === 'string' ? requestedStatus : 'active' }),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(actorOf(res).isSuperAdmin ? {} : { accessLevel: { lt: actorOf(res).accessLevel } }),
    };
    const prisma = getPrisma();
    const [roles, total] = await Promise.all([
      prisma.role.findMany({ where, include: { grants: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: [{ accessLevel: 'desc' }, { name: 'asc' }], skip, take: pageSize }),
      prisma.role.count({ where }),
    ]);
    res.json({ roles, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  router.post('/roles', requirePermission('roles.create'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'description', 'accessLevel', 'status', 'permissions']);
    const name = text(body.name, 'name', 80);
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 500) : '';
    const accessLevel = body.accessLevel === undefined ? Math.max(1, actor.accessLevel - 1) : Number(body.accessLevel);
    if (!Number.isInteger(accessLevel) || accessLevel < 1 || accessLevel > 99 || (!actor.isSuperAdmin && accessLevel >= actor.accessLevel)) throw new AdminError(403, 'Custom roles must be below your access level and cannot use the Super Admin level.');
    const permissionRecords = await resolvePermissions(body.permissions ?? [], actor);
    const status = body.status === undefined ? 'active' : body.status;
    if (status !== 'active' && status !== 'inactive') throw new AdminError(400, 'status must be active or inactive.');
    const role = await getPrisma().$transaction(async (tx) => {
      const created = await tx.role.create({ data: { name, description, accessLevel, status, isSystem: false, permissions: JSON.stringify(permissionRecords.map((item) => item.key)) } });
      if (permissionRecords.length) await tx.rolePermission.createMany({ data: permissionRecords.map((item) => ({ roleId: created.id, permissionId: item.id })) });
      await audit(tx, actor.id, 'ROLE_CREATED', 'Role', created.id, null, { name, description, accessLevel, status, permissions: permissionRecords.map((item) => item.key) }, req);
      return created;
    });
    res.status(201).json({ role });
  }));

  router.get('/roles/:id/users', requirePermission('users.view'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const role = await getPrisma().role.findUnique({ where: { id: req.params.id } });
    if (!role) throw new AdminError(404, 'Role not found.');
    if (!canManageAccessLevel(actor, role.accessLevel) && !actor.isSuperAdmin) throw new AdminError(403, 'You cannot view assignments for a role at or above your access level.');
    const { page, pageSize, skip } = pagination(req.query);
    const where = { roleId: role.id, ...(actor.isSuperAdmin ? {} : { isSuperAdmin: false }) };
    const [users, total] = await Promise.all([
      getPrisma().user.findMany({ where, select: { id: true, name: true, email: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      getPrisma().user.count({ where }),
    ]);
    res.json({ role: { id: role.id, name: role.name }, users, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  router.patch('/roles/:id', requirePermission('roles.update'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'description', 'accessLevel', 'status', 'permissions']);
    const before = await getPrisma().role.findUnique({ where: { id: req.params.id }, include: { grants: { include: { permission: { select: { key: true } } } }, _count: { select: { users: true } } } });
    if (!before) throw new AdminError(404, 'Role not found.');
    if (before.name === SUPER_ADMIN_ROLE || (before.isSystem && !actor.isSuperAdmin)) throw new AdminError(403, 'System roles can only be edited by the Super Admin; the Super Admin role itself is protected.');
    if (!canManageAccessLevel(actor, before.accessLevel)) throw new AdminError(403, 'You cannot manage a role at or above your access level.');
    const accessLevel = body.accessLevel === undefined ? before.accessLevel : Number(body.accessLevel);
    if (!Number.isInteger(accessLevel) || accessLevel < 1 || accessLevel > 99 || (!actor.isSuperAdmin && accessLevel >= actor.accessLevel)) throw new AdminError(403, 'The requested access level is outside your authority.');
    const status = body.status === undefined ? before.status : body.status;
    if (status !== 'active' && status !== 'inactive') throw new AdminError(400, 'status must be active or inactive.');
    if (status === 'inactive' && before._count.users > 0) throw new AdminError(409, 'Reassign users before deactivating this role.');
    const permissions = body.permissions === undefined
      ? before.grants.map((grant) => ({ id: grant.permissionId, key: grant.permission.key }))
      : await resolvePermissions(body.permissions, actor);
    const name = body.name === undefined ? before.name : text(body.name, 'name', 80);
    const description = body.description === undefined ? before.description : typeof body.description === 'string' ? body.description.trim().slice(0, 500) : (() => { throw new AdminError(400, 'description must be text.'); })();
    const role = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id: before.id }, data: { name, description, accessLevel, status, permissions: JSON.stringify(permissions.map((item) => item.key)) } });
      await tx.rolePermission.deleteMany({ where: { roleId: before.id } });
      if (permissions.length) await tx.rolePermission.createMany({ data: permissions.map((item) => ({ roleId: before.id, permissionId: item.id })) });
      await audit(tx, actor.id, 'ROLE_UPDATED', 'Role', before.id, { name: before.name, description: before.description, accessLevel: before.accessLevel, status: before.status, permissions: before.grants.map((grant) => grant.permission.key) }, { name, description, accessLevel, status, permissions: permissions.map((item) => item.key) }, req);
      return updated;
    });
    res.json({ role });
  }));

  router.delete('/roles/:id', requirePermission('roles.delete'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const role = await getPrisma().role.findUnique({ where: { id: req.params.id }, include: { _count: { select: { users: true } } } });
    if (!role) throw new AdminError(404, 'Role not found.');
    if (role.isSystem || role.name === SUPER_ADMIN_ROLE) throw new AdminError(403, 'System role templates cannot be deleted.');
    if (!canManageAccessLevel(actor, role.accessLevel)) throw new AdminError(403, 'You cannot delete a role at or above your access level.');
    if (role._count.users) throw new AdminError(409, 'Reassign users before deleting this role.');
    await getPrisma().$transaction(async (tx) => {
      await audit(tx, actor.id, 'ROLE_DELETED', 'Role', role.id, { name: role.name }, null, req);
      await tx.role.delete({ where: { id: role.id } });
    });
    res.status(204).end();
  }));

  router.get('/users', requirePermission('users.view'), endpoint(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const actor = actorOf(res);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const status = req.query.status;
    if (status !== undefined && (typeof status !== 'string' || !['active', 'suspended', 'inactive', 'all'].includes(status))) throw new AdminError(400, 'Invalid user status filter.');
    const where = {
      ...(actor.isSuperAdmin ? {} : { isSuperAdmin: false, role: { accessLevel: { lt: actor.accessLevel } } }),
      ...(typeof req.query.roleId === 'string' ? { roleId: req.query.roleId } : {}),
      ...(status && status !== 'all' ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { email: { contains: search, mode: 'insensitive' as const } }] } : {}),
    };
    const prisma = getPrisma();
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: { id: true, name: true, email: true, status: true, roleId: true, isSuperAdmin: true, createdAt: true, updatedAt: true, role: { select: { name: true, accessLevel: true } } }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  router.post('/users', requirePermission('users.create'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'email', 'password', 'roleId']);
    const name = text(body.name, 'name', 120);
    const email = text(body.email, 'email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminError(400, 'Enter a valid email address.');
    const password = text(body.password, 'password', 72);
    if (Buffer.byteLength(password, 'utf8') < 12) throw new AdminError(400, 'Password must contain at least 12 UTF-8 bytes.');
    const roleId = text(body.roleId, 'roleId', 64);
    const role = await scopedRole(roleId, actor);
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await getPrisma().$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash, roleId, status: 'active', isSuperAdmin: false }, select: { id: true, name: true, email: true, status: true, roleId: true, createdAt: true } });
      await audit(tx, actor.id, 'USER_CREATED', 'User', user.id, null, { name, email, roleId, roleName: role.name }, req);
      return user;
    });
    res.status(201).json({ user: created });
  }));

  router.patch('/users/:id', requirePermission('users.update'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const body = objectBody(req.body);
    rejectUnknown(body, ['name', 'email', 'roleId']);
    if (Object.keys(body).length === 0) throw new AdminError(400, 'Provide user details to update.');
    const before = await scopedUser(req.params.id, actor);
    const data: { name?: string; email?: string; roleId?: string } = {};
    if (body.name !== undefined) data.name = text(body.name, 'name', 120);
    if (body.email !== undefined) {
      const email = text(body.email, 'email', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminError(400, 'Enter a valid email address.');
      data.email = email;
    }
    if (body.roleId !== undefined) {
      const roleId = text(body.roleId, 'roleId', 64);
      const role = await scopedRole(roleId, actor);
      const grants = await getPrisma().userPermission.findMany({ where: { userId: before.id, granted: true }, include: { permission: { select: { key: true } } } });
      if (!canGrantPermissions(actor, [...role.grants.map((grant) => grant.permission.key), ...grants.map((grant) => grant.permission.key)])) {
        throw new AdminError(403, 'You cannot assign this role while the user has permissions you do not hold.');
      }
      data.roleId = roleId;
    }
    const user = await getPrisma().$transaction(async (tx) => {
      const updated = await tx.user.update({ where: { id: before.id }, data, select: { id: true, name: true, email: true, status: true, roleId: true, updatedAt: true } });
      await audit(tx, actor.id, 'USER_UPDATED', 'User', before.id, { name: before.name, email: before.email, roleId: before.roleId }, updated, req);
      if (data.roleId && data.roleId !== before.roleId) await tx.session.updateMany({ where: { userId: before.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    res.json({ user });
  }));

  for (const [path, status] of [['suspend', 'suspended'], ['activate', 'active']] as const) {
    router.post(`/users/:id/${path}`, requirePermission('users.suspend'), endpoint(async (req, res) => {
      const actor = actorOf(res);
      const before = await scopedUser(req.params.id, actor);
      const user = await getPrisma().$transaction(async (tx) => {
        const updated = await tx.user.update({ where: { id: before.id }, data: { status }, select: { id: true, name: true, email: true, status: true, roleId: true, updatedAt: true } });
        if (status !== 'active') await tx.session.updateMany({ where: { userId: before.id, revokedAt: null }, data: { revokedAt: new Date() } });
        await audit(tx, actor.id, status === 'active' ? 'USER_ACTIVATED' : 'USER_SUSPENDED', 'User', before.id, { status: before.status }, { status }, req);
        return updated;
      });
      res.json({ user });
    }));
  }

  router.delete('/users/:id', requirePermission('users.delete'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const prisma = getPrisma();
    const [createdTransactions, approvedTransactions, rejectedTransactions, voidedTransactions, logs, reports] = await Promise.all([
      prisma.transaction.count({ where: { createdById: target.id } }), prisma.transaction.count({ where: { approvedById: target.id } }),
      prisma.transaction.count({ where: { rejectedById: target.id } }), prisma.transaction.count({ where: { voidedById: target.id } }),
      prisma.auditLog.count({ where: { userId: target.id } }), prisma.report.count({ where: { generatedById: target.id } }),
    ]);
    if (createdTransactions + approvedTransactions + rejectedTransactions + voidedTransactions + logs + reports > 0) throw new AdminError(409, 'This user has financial or audit history and cannot be deleted. Suspend the account instead.');
    await prisma.$transaction(async (tx) => {
      await audit(tx, actor.id, 'USER_DELETED', 'User', target.id, { name: target.name, email: target.email }, null, req);
      await tx.user.delete({ where: { id: target.id } });
    });
    res.status(204).end();
  }));

  router.patch('/users/:id/permissions', requirePermission('permissions.assign'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const body = objectBody(req.body);
    rejectUnknown(body, ['overrides']);
    if (!Array.isArray(body.overrides) || body.overrides.length > 100) throw new AdminError(400, 'overrides must be an array with at most 100 entries.');
    const overrides = body.overrides as unknown[];
    const keys = overrides.map((item) => {
      const entry = objectBody(item);
      rejectUnknown(entry, ['permission', 'granted']);
      if (typeof entry.permission !== 'string' || typeof entry.granted !== 'boolean') throw new AdminError(400, 'Each override needs a permission key and granted boolean.');
      return entry.permission;
    });
    if (new Set(keys).size !== keys.length) throw new AdminError(400, 'Permission overrides must be unique.');
    const records = await getPrisma().permission.findMany({ where: { key: { in: keys } }, select: { id: true, key: true } });
    if (records.length !== keys.length) throw new AdminError(400, 'One or more permission keys are unknown.');
    const additions = overrides.filter((item) => (item as { granted: boolean }).granted).map((item) => (item as { permission: string }).permission);
    if (!canGrantPermissions(actor, additions)) throw new AdminError(403, 'You cannot grant permissions you do not hold.');
    await getPrisma().$transaction(async (tx) => {
      for (const item of overrides as { permission: string; granted: boolean }[]) {
        const permission = records.find((record) => record.key === item.permission)!;
        await tx.userPermission.upsert({ where: { userId_permissionId: { userId: target.id, permissionId: permission.id } }, update: { granted: item.granted }, create: { userId: target.id, permissionId: permission.id, granted: item.granted } });
      }
      await audit(tx, actor.id, 'USER_PERMISSIONS_UPDATED', 'User', target.id, null, overrides, req);
    });
    res.json({ message: 'User permission overrides saved.' });
  }));

  router.get('/users/:id/permissions', requirePermission('users.view'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const [roleGrants, overrides] = await Promise.all([
      getPrisma().rolePermission.findMany({ where: { roleId: target.roleId }, include: { permission: true } }),
      getPrisma().userPermission.findMany({ where: { userId: target.id }, include: { permission: true } }),
    ]);
    const effective = new Set(roleGrants.map((grant) => grant.permission.key));
    for (const override of overrides) {
      if (override.granted) effective.add(override.permission.key);
      else effective.delete(override.permission.key);
    }
    res.json({ role: target.role.name, effectivePermissions: [...effective].sort(), overrides: overrides.map((override) => ({ permission: override.permission.key, granted: override.granted })) });
  }));

  router.post('/users/:id/password-reset', requirePermission('users.update'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await getPrisma().$transaction(async (tx) => {
      await tx.passwordReset.updateMany({ where: { userId: target.id, usedAt: null }, data: { usedAt: new Date() } });
      await tx.passwordReset.create({ data: { userId: target.id, tokenHash, expiresAt } });
      await audit(tx, actor.id, 'PASSWORD_RESET_INITIATED', 'User', target.id, null, { expiresAt }, req);
    });
    res.status(201).json({ resetToken: rawToken, expiresAt, delivery: 'Deliver this token to the user through your approved secure channel; no email provider is configured.' });
  }));

  router.post('/users/:id/sessions/revoke', requirePermission('sessions.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const result = await getPrisma().$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({ where: { userId: target.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(tx, actor.id, 'USER_SESSIONS_REVOKED', 'User', target.id, null, { revokedCount: revoked.count }, req);
      return revoked.count;
    });
    res.json({ revokedSessions: result });
  }));

  router.get('/users/:id/sessions', requirePermission('sessions.manage'), endpoint(async (req, res) => {
    const actor = actorOf(res);
    const target = await scopedUser(req.params.id, actor);
    const sessions = await getPrisma().session.findMany({
      where: { userId: target.id, expiresAt: { gt: new Date() } },
      select: { id: true, createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true, ipAddress: true, device: true },
      orderBy: { createdAt: 'desc' }, take: 50,
    });
    res.json({ sessions });
  }));

  router.get('/audit-logs', requirePermission('audit_logs.view'), endpoint(async (req, res) => {
    const { page, pageSize, skip } = pagination(req.query);
    const prisma = getPrisma();
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, skip, take: pageSize, include: { user: { select: { id: true, name: true, email: true } } } }),
      prisma.auditLog.count(),
    ]);
    res.json({ auditLogs: logs, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  return router;
}
