import { afterEach, describe, expect, it } from 'vitest';
import { getPrisma } from './db.js';

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
});

describe('database configuration', () => {
  it('fails clearly when no database URL is configured', () => {
    delete process.env.DATABASE_URL;

    expect(() => getPrisma()).toThrow('DATABASE_URL is not configured.');
  });
});