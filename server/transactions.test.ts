import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import { createTransactionRouter } from './transactions.js';

const { prismaMock } = vi.hoisted(() => {
  const mock: Record<string, any> = {
    transaction: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), findUnique: vi.fn(), groupBy: vi.fn() },
    category: { findMany: vi.fn(), findUnique: vi.fn() },
    account: { findMany: vi.fn(), findUnique: vi.fn() },
    paymentMethod: { findUnique: vi.fn() },
    auditLog: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  mock.$transaction.mockImplementation((callback: (client: unknown) => unknown) => callback(mock));
  return { prismaMock: mock };
});

vi.mock('./db.js', () => ({
  getPrisma: () => prismaMock,
  withDatabaseRetry: (operation: () => Promise<unknown>) => operation(),
}));

let server: Server;
let baseUrl: string;

async function startServer(role = 'Viewer', permissions: string[] = []) {
  const app = express();
  app.use(express.json());
  const session: RequestHandler = (_req, res, next) => {
    res.locals.authUser = { id: 'user-1', name: 'Test User', email: 'test@example.com', role, permissions, isSuperAdmin: false };
    next();
  };
  const authorize = (permission: string): RequestHandler => (_req, res, next) => {
    const actor = res.locals.authUser as { permissions: string[]; isSuperAdmin: boolean };
    if (!actor.isSuperAdmin && !actor.permissions.includes(permission)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    next();
  };
  app.use('/api/transactions', createTransactionRouter(session, authorize));
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  baseUrl = `http://127.0.0.1:${address.port}/api/transactions`;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

describe('transaction API', () => {
  it('serves the authenticated transaction list with pagination', async () => {
    prismaMock.transaction.findMany.mockResolvedValue([]);
    prismaMock.transaction.count.mockResolvedValue(0);
    await startServer('Treasurer', ['transactions.view']);
    const response = await fetch(`${baseUrl}?page=1&pageSize=10`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transactions: [], pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 } });
  });

  it.each([
    ['POST', '/', {}],
    ['PATCH', '/00000000-0000-4000-8000-000000000001', {}],
    ['POST', '/00000000-0000-4000-8000-000000000001/approve', {}],
    ['POST', '/00000000-0000-4000-8000-000000000001/reject', { reason: 'No evidence' }],
    ['POST', '/00000000-0000-4000-8000-000000000001/void', { reason: 'Entered in error' }],
    ['POST', '/00000000-0000-4000-8000-000000000001/restore', {}],
  ])('denies viewer %s %s without touching the database', async (method, path, body) => {
    await startServer('Viewer');
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.transaction.findUnique).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination and unsupported filters', async () => {
    await startServer('Viewer', ['transactions.view']);
    const invalidPage = await fetch(`${baseUrl}?page=0`);
    expect(invalidPage.status).toBe(400);
    const unknownFilter = await fetch(`${baseUrl}?unexpected=value`);
    expect(unknownFilter.status).toBe(400);
    expect(prismaMock.transaction.findMany).not.toHaveBeenCalled();
  });

  it('rejects numeric JSON amounts instead of accepting floating-point values', async () => {
    await startServer('Admin', ['transactions.create']);
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'INCOME', date: '2026-10-09', categoryId: 'category', description: 'Fee', amount: 25.5, paymentMethodId: 'cash', accountId: 'bank' }),
    });
    expect(response.status).toBe(400);
    expect(prismaMock.category.findUnique).not.toHaveBeenCalled();
  });
});
