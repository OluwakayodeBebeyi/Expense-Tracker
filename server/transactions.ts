import express, { type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma, withDatabaseRetry } from './db.js';

const router = express.Router();
const transactionInclude = {
  category: { select: { id: true, name: true, type: true } },
  account: { select: { id: true, name: true, type: true } },
  paymentMethod: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
  voidedBy: { select: { id: true, name: true } },
} satisfies Prisma.TransactionInclude;

class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

const endpoint = (handler: (req: express.Request, res: express.Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof ApiError) {
        res.status(error.status).json({ message: error.message });
        return;
      }
      next(error);
    });
  };

const userId = (res: express.Response): string => {
  const user = res.locals.authUser as { id?: string } | undefined;
  if (!user?.id) throw new ApiError(401, 'Please sign in to continue.');
  return user.id;
};

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) {
    throw new ApiError(400, `${field} must be a valid date.`);
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new ApiError(400, `${field} must be a valid date.`);
  return date;
}

function dateFilters(query: express.Request['query']): Prisma.DateTimeFilter | undefined {
  const filter: Prisma.DateTimeFilter = {};
  const start = query.startDate;
  const end = query.endDate;
  if (start !== undefined) filter.gte = parseDate(start, 'startDate');
  if (end !== undefined) {
    const parsed = parseDate(end, 'endDate');
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(end))) parsed.setUTCDate(parsed.getUTCDate() + 1);
    filter.lt = parsed;
  }
  if (filter.gte && filter.lt && filter.gte >= filter.lt) throw new ApiError(400, 'startDate must be earlier than endDate.');
  return Object.keys(filter).length ? filter : undefined;
}

function optionalString(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) throw new ApiError(400, `${field} must be at most ${maxLength} characters.`);
  return value.trim();
}

function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new ApiError(400, `${field} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function parseAmount(value: unknown): Prisma.Decimal {
  if (typeof value !== 'string') throw new ApiError(400, 'amount must be a decimal string with no more than two decimal places.');
  const raw = value;
  if (!/^\d{1,15}(?:\.\d{1,2})?$/.test(raw)) throw new ApiError(400, 'amount must be a positive amount with no more than two decimal places.');
  const amount = new Prisma.Decimal(raw);
  if (!amount.isFinite() || !amount.gt(0)) throw new ApiError(400, 'amount must be greater than zero.');
  return amount;
}

const writableFields = new Set([
  'type', 'date', 'categoryId', 'description', 'amount', 'paymentMethodId', 'accountId',
  'sourceOrVendor', 'referenceNumber', 'academicSession', 'financialYear', 'notes',
]);

function validateFields(body: unknown, partial = false): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'A JSON object is required.');
  const input = body as Record<string, unknown>;
  const unknown = Object.keys(input).find((key) => !writableFields.has(key));
  if (unknown) throw new ApiError(400, `The ${unknown} field cannot be set through this endpoint.`);
  if (!partial && ['type', 'date', 'categoryId', 'description', 'amount', 'paymentMethodId', 'accountId'].some((key) => input[key] === undefined)) {
    throw new ApiError(400, 'type, date, categoryId, description, amount, paymentMethodId and accountId are required.');
  }
  const data: Record<string, unknown> = {};
  if (input.type !== undefined) {
    if (input.type !== 'INCOME' && input.type !== 'EXPENDITURE') throw new ApiError(400, 'type must be INCOME or EXPENDITURE.');
    data.type = input.type;
  }
  if (input.date !== undefined) data.date = parseDate(input.date, 'date');
  if (input.categoryId !== undefined) data.categoryId = requireString(input.categoryId, 'categoryId', 64);
  if (input.description !== undefined) data.description = requireString(input.description, 'description', 2000);
  if (input.amount !== undefined) data.amount = parseAmount(input.amount);
  if (input.paymentMethodId !== undefined) data.paymentMethodId = requireString(input.paymentMethodId, 'paymentMethodId', 64);
  if (input.accountId !== undefined) data.accountId = requireString(input.accountId, 'accountId', 64);
  for (const [field, limit] of [['sourceOrVendor', 250], ['referenceNumber', 250], ['academicSession', 100], ['financialYear', 100], ['notes', 4000]] as const) {
    if (input[field] !== undefined) data[field] = optionalString(input[field], field, limit);
  }
  return data;
}

async function validateReferences(data: Record<string, unknown>): Promise<void> {
  const prisma = getPrisma();
  const [category, account, paymentMethod] = await Promise.all([
    data.categoryId ? prisma.category.findUnique({ where: { id: String(data.categoryId) } }) : null,
    data.accountId ? prisma.account.findUnique({ where: { id: String(data.accountId) } }) : null,
    data.paymentMethodId ? prisma.paymentMethod.findUnique({ where: { id: String(data.paymentMethodId) } }) : null,
  ]);
  if (data.categoryId && (!category || category.status !== 'active')) throw new ApiError(400, 'The selected category does not exist or is inactive.');
  if (category && data.type && category.type.toUpperCase() !== data.type) throw new ApiError(400, 'The selected category does not match the transaction type.');
  if (data.accountId && (!account || account.status !== 'active')) throw new ApiError(400, 'The selected account does not exist or is inactive.');
  if (data.paymentMethodId && (!paymentMethod || paymentMethod.status !== 'active')) throw new ApiError(400, 'The selected payment method does not exist or is inactive.');
}

function snapshot(value: unknown): string {
  return JSON.stringify(value, (_key, item) => item instanceof Prisma.Decimal ? item.toString() : item);
}

function transactionIdParam(req: express.Request): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    throw new ApiError(400, 'A valid transaction ID is required.');
  }
  return req.params.id;
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  transactionId: string,
  previousValue: unknown,
  newValue: unknown,
  req: express.Request,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action,
      entity: 'Transaction',
      entityId: transactionId,
      previousValue: previousValue === null ? null : snapshot(previousValue),
      newValue: newValue === null ? null : snapshot(newValue),
      ipAddress: req.ip,
      device: req.get('user-agent')?.slice(0, 500),
    },
  });
}

function makeWhere(query: express.Request['query']): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};
  const oneOf = (key: string, allowed?: readonly string[]) => {
    const value = query[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || (allowed && !allowed.includes(value))) throw new ApiError(400, `Invalid ${key} filter.`);
    return value;
  };
  const type = oneOf('type', ['INCOME', 'EXPENDITURE']);
  const status = oneOf('status', ['pending', 'approved', 'rejected', 'voided']);
  const categoryId = oneOf('categoryId');
  const accountId = oneOf('accountId');
  const paymentMethodId = oneOf('paymentMethodId');
  const academicSession = oneOf('academicSession');
  const financialYear = oneOf('financialYear');
  if (type) where.type = type;
  if (status) where.status = status;
  if (categoryId) where.categoryId = categoryId;
  if (accountId) where.accountId = accountId;
  if (paymentMethodId) where.paymentMethodId = paymentMethodId;
  if (academicSession) where.academicSession = academicSession;
  if (financialYear) where.financialYear = financialYear;
  const date = dateFilters(query);
  if (date) where.date = date;
  const search = query.search;
  if (search !== undefined) {
    if (typeof search !== 'string' || search.length > 200) throw new ApiError(400, 'search must be at most 200 characters.');
    if (search.trim()) where.OR = [
      { transactionId: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
      { referenceNumber: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  return where;
}

export function createTransactionRouter(requireSession: RequestHandler, authorize: (permission: string) => RequestHandler) {
  const api = express.Router();
  api.use(requireSession);

  api.get('/', authorize('transactions.view'), endpoint(async (req, res) => {
    const allowedQuery = new Set(['type', 'startDate', 'endDate', 'categoryId', 'accountId', 'paymentMethodId', 'status', 'academicSession', 'financialYear', 'search', 'page', 'pageSize', 'sortBy', 'sortOrder']);
    const unknownQuery = Object.keys(req.query).find((key) => !allowedQuery.has(key));
    if (unknownQuery) throw new ApiError(400, `Unsupported query parameter: ${unknownQuery}.`);
    const where = makeWhere(req.query);
    const pageValue = req.query.page ?? '1';
    const pageSizeValue = req.query.pageSize ?? '20';
    const page = Number(pageValue);
    const pageSize = Number(pageSizeValue);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      throw new ApiError(400, 'page must be positive and pageSize must be between 1 and 100.');
    }
    const allowedSorts = ['date', 'transactionId', 'amount', 'createdAt', 'updatedAt', 'status'] as const;
    const sortBy = req.query.sortBy ?? 'date';
    const sortOrder = req.query.sortOrder ?? 'desc';
    if (typeof sortBy !== 'string' || !allowedSorts.includes(sortBy as typeof allowedSorts[number]) || (sortOrder !== 'asc' && sortOrder !== 'desc')) {
      throw new ApiError(400, 'Invalid sortBy or sortOrder.');
    }
    const prisma = getPrisma();
    const [transactions, total] = await withDatabaseRetry(() => Promise.all([
      prisma.transaction.findMany({ where, include: transactionInclude, orderBy: { [sortBy]: sortOrder } as Prisma.TransactionOrderByWithRelationInput, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.transaction.count({ where }),
    ]));
    res.json({ transactions, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
  }));

  // Keep summary above /:id.
  api.get('/summary', authorize('reports.view'), endpoint(async (req, res) => {
    const unknownQuery = Object.keys(req.query).find((key) => key !== 'startDate' && key !== 'endDate' && key !== 'breakdowns');
    if (unknownQuery) throw new ApiError(400, `Unsupported query parameter: ${unknownQuery}.`);
    if (req.query.breakdowns !== undefined && req.query.breakdowns !== 'true' && req.query.breakdowns !== 'false') throw new ApiError(400, 'breakdowns must be true or false.');
    const date = dateFilters(req.query);
    const where: Prisma.TransactionWhereInput = { status: 'approved', ...(date ? { date } : {}) };
    const prisma = getPrisma();
    const [income, expenditure, transactionCount] = await withDatabaseRetry(() => Promise.all([
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { ...where, type: 'INCOME' } }),
      prisma.transaction.aggregate({ _sum: { amount: true }, where: { ...where, type: 'EXPENDITURE' } }),
      prisma.transaction.count({ where }),
    ]));
    const totalIncome = income._sum.amount ?? new Prisma.Decimal(0);
    const totalExpenditure = expenditure._sum.amount ?? new Prisma.Decimal(0);
    const summary: Record<string, unknown> = {
      totalIncome: totalIncome.toString(),
      totalExpenditure: totalExpenditure.toString(),
      netBalance: totalIncome.minus(totalExpenditure).toString(),
      transactionCount,
      policy: 'Only approved transactions are included; pending, rejected and voided transactions are excluded.',
    };
    if (req.query.breakdowns === 'true') {
      const [byCategory, byAccount] = await Promise.all([
        prisma.transaction.groupBy({ by: ['categoryId', 'type'], where, _sum: { amount: true }, _count: { _all: true } }),
        prisma.transaction.groupBy({ by: ['accountId', 'type'], where, _sum: { amount: true }, _count: { _all: true } }),
      ]);
      const [categories, accounts] = await Promise.all([
        prisma.category.findMany({ where: { id: { in: [...new Set(byCategory.map((row) => row.categoryId))] } }, select: { id: true, name: true } }),
        prisma.account.findMany({ where: { id: { in: [...new Set(byAccount.map((row) => row.accountId))] } }, select: { id: true, name: true } }),
      ]);
      const categoryNames = new Map(categories.map((item) => [item.id, item.name]));
      const accountNames = new Map(accounts.map((item) => [item.id, item.name]));
      summary.byCategory = byCategory.map((row) => ({ id: row.categoryId, name: categoryNames.get(row.categoryId), type: row.type, total: (row._sum.amount ?? new Prisma.Decimal(0)).toString(), count: row._count._all }));
      summary.byAccount = byAccount.map((row) => ({ id: row.accountId, name: accountNames.get(row.accountId), type: row.type, total: (row._sum.amount ?? new Prisma.Decimal(0)).toString(), count: row._count._all }));
    }
    res.json({ summary });
  }));

  api.get('/:id/audit-logs', authorize('audit_logs.view'), endpoint(async (req, res) => {
    const id = transactionIdParam(req);
    const existing = await getPrisma().transaction.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ApiError(404, 'Transaction not found.');
    const logs = await getPrisma().auditLog.findMany({
      where: { entity: 'Transaction', entityId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json({ auditLogs: logs });
  }));

  api.get('/:id', authorize('transactions.view'), endpoint(async (req, res) => {
    const transaction = await getPrisma().transaction.findUnique({ where: { id: transactionIdParam(req) }, include: transactionInclude });
    if (!transaction) throw new ApiError(404, 'Transaction not found.');
    res.json({ transaction });
  }));

  api.post('/', authorize('transactions.create'), endpoint(async (req, res) => {
    const data = validateFields(req.body);
    await validateReferences(data);
    const actorId = userId(res);
    const date = data.date as Date;
    const prefix = data.type === 'INCOME' ? 'INC' : 'EXP';
    const transactionId = `${prefix}-${date.getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await getPrisma().$transaction(async (tx) => {
      const transaction = await tx.transaction.create({ data: {
        ...data,
        transactionId,
        status: 'pending',
        approvalStatus: 'pending',
        createdById: actorId,
      } as Prisma.TransactionUncheckedCreateInput, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_CREATED', transaction.id, null, transaction, req);
      return transaction;
    });
    res.status(201).json({ transaction: created });
  }));

  api.patch('/:id', authorize('transactions.update'), endpoint(async (req, res) => {
    const data = validateFields(req.body, true);
    if (Object.keys(data).length === 0) throw new ApiError(400, 'Provide at least one transaction field to update.');
    const prisma = getPrisma();
    const actorId = userId(res);
    const id = transactionIdParam(req);
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.transaction.findUnique({ where: { id }, include: transactionInclude });
      if (!before) throw new ApiError(404, 'Transaction not found.');
      if (before.status !== 'pending' && before.status !== 'rejected') throw new ApiError(409, 'Only pending or rejected transactions can be edited.');
      await validateReferences({ type: data.type ?? before.type, categoryId: data.categoryId ?? before.categoryId, accountId: data.accountId ?? before.accountId, paymentMethodId: data.paymentMethodId ?? before.paymentMethodId });
      const updateData = (before.status === 'rejected'
        ? { ...data, status: 'pending', approvalStatus: 'pending', rejectedById: null, rejectionReason: null }
        : data) as Prisma.TransactionUncheckedUpdateInput;
      const claimed = await tx.transaction.updateMany({ where: { id: before.id, status: before.status }, data: updateData });
      if (!claimed.count) throw new ApiError(409, 'This transaction has already changed. Reload it and try again.');
      const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: before.id }, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_UPDATED', transaction.id, before, transaction, req);
      return transaction;
    });
    res.json({ transaction: updated });
  }));

  api.post('/:id/approve', authorize('transactions.approve'), endpoint(async (req, res) => {
    const actorId = userId(res);
    const id = transactionIdParam(req);
    const transaction = await getPrisma().$transaction(async (tx) => {
      const before = await tx.transaction.findUnique({ where: { id }, include: transactionInclude });
      if (!before) throw new ApiError(404, 'Transaction not found.');
      if (before.status !== 'pending') throw new ApiError(409, 'Only pending transactions can be approved.');
      const claimed = await tx.transaction.updateMany({ where: { id, status: 'pending' }, data: {
        status: 'approved', approvalStatus: 'approved', approvedById: actorId, approvedAt: new Date(),
        approvalNotes: optionalString(req.body?.notes, 'notes', 4000) ?? null,
      } });
      if (!claimed.count) throw new ApiError(409, 'This transaction has already changed. Reload it and try again.');
      const accountChange = before.type === 'INCOME' ? before.amount : before.amount.negated();
      await tx.account.update({ where: { id: before.accountId }, data: { currentBalance: { increment: accountChange } } });
      const after = await tx.transaction.findUniqueOrThrow({ where: { id }, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_APPROVED', after.id, before, after, req);
      return after;
    });
    res.json({ transaction });
  }));

  api.post('/:id/reject', authorize('transactions.reject'), endpoint(async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(400, 'A JSON object with a reason is required.');
    const reason = requireString(req.body.reason, 'reason', 2000);
    const actorId = userId(res);
    const id = transactionIdParam(req);
    const transaction = await getPrisma().$transaction(async (tx) => {
      const before = await tx.transaction.findUnique({ where: { id }, include: transactionInclude });
      if (!before) throw new ApiError(404, 'Transaction not found.');
      if (before.status !== 'pending') throw new ApiError(409, 'Only pending transactions can be rejected.');
      const claimed = await tx.transaction.updateMany({ where: { id, status: 'pending' }, data: { status: 'rejected', approvalStatus: 'rejected', rejectedById: actorId, rejectionReason: reason } });
      if (!claimed.count) throw new ApiError(409, 'This transaction has already changed. Reload it and try again.');
      const after = await tx.transaction.findUniqueOrThrow({ where: { id }, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_REJECTED', after.id, before, after, req);
      return after;
    });
    res.json({ transaction });
  }));

  api.post('/:id/void', authorize('transactions.void'), endpoint(async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw new ApiError(400, 'A JSON object with a reason is required.');
    const reason = requireString(req.body.reason, 'reason', 2000);
    const actorId = userId(res);
    const id = transactionIdParam(req);
    const transaction = await getPrisma().$transaction(async (tx) => {
      const before = await tx.transaction.findUnique({ where: { id }, include: transactionInclude });
      if (!before) throw new ApiError(404, 'Transaction not found.');
      if (before.status !== 'approved') throw new ApiError(409, 'Only approved transactions can be voided.');
      const claimed = await tx.transaction.updateMany({ where: { id, status: 'approved' }, data: { status: 'voided', voidReason: reason, voidedById: actorId, voidedAt: new Date() } });
      if (!claimed.count) throw new ApiError(409, 'This transaction has already changed. Reload it and try again.');
      const accountChange = before.type === 'INCOME' ? before.amount.negated() : before.amount;
      await tx.account.update({ where: { id: before.accountId }, data: { currentBalance: { increment: accountChange } } });
      const after = await tx.transaction.findUniqueOrThrow({ where: { id }, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_VOIDED', after.id, before, after, req);
      return after;
    });
    res.json({ transaction });
  }));

  api.post('/:id/restore', authorize('transactions.restore'), endpoint(async (req, res) => {
    const actorId = userId(res);
    const id = transactionIdParam(req);
    const transaction = await getPrisma().$transaction(async (tx) => {
      const before = await tx.transaction.findUnique({ where: { id }, include: transactionInclude });
      if (!before) throw new ApiError(404, 'Transaction not found.');
      if (before.status !== 'voided' || before.approvalStatus !== 'approved') throw new ApiError(409, 'Only voided, previously approved transactions can be restored.');
      const claimed = await tx.transaction.updateMany({ where: { id, status: 'voided', approvalStatus: 'approved' }, data: { status: 'approved', voidReason: null, voidedById: null, voidedAt: null } });
      if (!claimed.count) throw new ApiError(409, 'This transaction has already changed. Reload it and try again.');
      const accountChange = before.type === 'INCOME' ? before.amount : before.amount.negated();
      await tx.account.update({ where: { id: before.accountId }, data: { currentBalance: { increment: accountChange } } });
      const after = await tx.transaction.findUniqueOrThrow({ where: { id }, include: transactionInclude });
      await writeAudit(tx, actorId, 'TRANSACTION_RESTORED', after.id, before, after, req);
      return after;
    });
    res.json({ transaction });
  }));

  return api;
}

export default router;
