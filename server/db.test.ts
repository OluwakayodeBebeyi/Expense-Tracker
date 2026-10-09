import { afterEach, describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { getPrisma, resolveDatabaseUrl, withDatabaseRetry } from './db.js';

const originalDatabaseUrl = process.env.DATABASE_URL;
const originalNeonDatabaseUrl = process.env.DATABASE_POSTGRES_PRISMA_URL;
const originalPostgresPrismaUrl = process.env.POSTGRES_PRISMA_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  if (originalNeonDatabaseUrl === undefined) {
    delete process.env.DATABASE_POSTGRES_PRISMA_URL;
  } else {
    process.env.DATABASE_POSTGRES_PRISMA_URL = originalNeonDatabaseUrl;
  }
  if (originalPostgresPrismaUrl === undefined) {
    delete process.env.POSTGRES_PRISMA_URL;
  } else {
    process.env.POSTGRES_PRISMA_URL = originalPostgresPrismaUrl;
  }
  if (originalPostgresUrl === undefined) {
    delete process.env.POSTGRES_URL;
  } else {
    process.env.POSTGRES_URL = originalPostgresUrl;
  }
});

describe('database configuration', () => {
  it('fails clearly when no database URL is configured', () => {
    delete process.env.DATABASE_URL;
    delete process.env.DATABASE_POSTGRES_PRISMA_URL;

    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL;

    expect(() => getPrisma()).toThrow('No supported PostgreSQL connection URL is configured. Set DATABASE_URL.');
  });

  it("prefers the app URL and accepts Neon's Prisma URL", () => {
    expect(resolveDatabaseUrl({ DATABASE_URL: 'postgresql://app-db' })).toBe('postgresql://app-db');
    expect(resolveDatabaseUrl({ POSTGRES_PRISMA_URL: 'postgresql://neon-db' })).toBe('postgresql://neon-db');
    expect(resolveDatabaseUrl({ POSTGRES_URL: 'postgresql://neon-db' })).toBe('postgresql://neon-db');
    expect(resolveDatabaseUrl({ DATABASE_POSTGRES_PRISMA_URL: 'postgresql://legacy-neon-db' })).toBe('postgresql://legacy-neon-db');
    expect(resolveDatabaseUrl({ DATABASE_URL: '  ', POSTGRES_PRISMA_URL: 'postgresql://neon-db' })).toBe('postgresql://neon-db');
  });

  it('retries transient database startup failures for read queries', async () => {
    let attempts = 0;
    const result = await withDatabaseRetry(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Prisma.PrismaClientInitializationError('Temporary connection failure', '5.22.0', 'P1001');
      }
      return 'connected';
    });

    expect(result).toBe('connected');
    expect(attempts).toBe(3);
  });
});
