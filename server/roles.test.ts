import { describe, expect, it } from 'vitest';
import { ALL_PERMISSION_KEYS, DEFAULT_ROLE_TEMPLATES, hasPermission, isTransactionManagerRole, PERMISSIONS, SUPER_ADMIN_ROLE } from './roles.js';

describe('database-backed permission catalogue and role templates', () => {
  it('defines unique granular permission keys', () => {
    const keys = PERMISSIONS.map((permission) => permission.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain('transactions.approve');
    expect(keys).toContain('users.suspend');
  });

  it('keeps the Super Admin template complete and distinct', () => {
    const owner = DEFAULT_ROLE_TEMPLATES.find((role) => role.name === SUPER_ADMIN_ROLE);
    expect(owner?.accessLevel).toBe(100);
    expect(owner?.permissions).toEqual(ALL_PERMISSION_KEYS);
  });

  it('does not grant permissions based on role names', () => {
    expect(hasPermission([], 'transactions.approve')).toBe(false);
    expect(hasPermission(['transactions.view'], 'transactions.approve')).toBe(false);
  });

  it('keeps default viewer read-only and auditor permissions scoped', () => {
    const viewer = DEFAULT_ROLE_TEMPLATES.find((role) => role.name === 'Management / Viewer');
    const auditor = DEFAULT_ROLE_TEMPLATES.find((role) => role.name === 'Auditor');
    expect(viewer?.permissions).toEqual(['dashboard.view', 'reports.view']);
    expect(auditor?.permissions).toContain('audit_logs.view');
    expect(auditor?.permissions).not.toContain('transactions.update');
  });

  it('requires both transaction permission and the approved job title gate', () => {
    expect(isTransactionManagerRole('Financial Secretary', false)).toBe(true);
    expect(isTransactionManagerRole('Treasurer', false)).toBe(true);
    expect(isTransactionManagerRole('Accountant / Bursar', false)).toBe(false);
    expect(isTransactionManagerRole('Super Admin', true)).toBe(true);
    expect(isTransactionManagerRole('Super Admin', false)).toBe(false);
  });
});
