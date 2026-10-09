import { afterEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { requirePermission } from './access.js';

const { auditCreate } = vi.hoisted(() => ({ auditCreate: vi.fn().mockResolvedValue({}) }));
vi.mock('./db.js', () => ({ getPrisma: () => ({ auditLog: { create: auditCreate } }) }));

let server: Server;
let url: string;

async function start(role: string, permissions: string[], isSuperAdmin = false) {
  const app = express();
  app.use((_req, res, next) => { res.locals.authUser = { id: 'u1', role, permissions, isSuperAdmin }; next(); });
  app.post('/transaction', requirePermission('transactions.approve'), (_req, res) => res.status(204).end());
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not start.');
  url = `http://127.0.0.1:${address.port}/transaction`;
}

afterEach(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  vi.clearAllMocks();
});

describe('permission middleware', () => {
  it('requires a permission even for transaction manager job titles', async () => {
    await start('Treasurer', []);
    const response = await fetch(url, { method: 'POST' });
    expect(response.status).toBe(403);
  });

  it('blocks transaction workflow permissions for unapproved titles', async () => {
    await start('Accountant / Bursar', ['transactions.approve']);
    const response = await fetch(url, { method: 'POST' });
    expect(response.status).toBe(403);
  });

  it('allows a permitted financial secretary', async () => {
    await start('Financial Secretary', ['transactions.approve']);
    const response = await fetch(url, { method: 'POST' });
    expect(response.status).toBe(204);
  });

  it('grants full access only to the protected Super Admin flag', async () => {
    await start('Super Admin', [], true);
    const response = await fetch(url, { method: 'POST' });
    expect(response.status).toBe(204);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
