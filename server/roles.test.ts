import { describe, expect, it } from 'vitest';
import { SUPER_ADMIN_PERMISSIONS, SUPER_ADMIN_ROLE } from './roles.js';

describe('Super Admin role', () => {
  it('has an explicit full-administration permission set', () => {
    expect(SUPER_ADMIN_ROLE).toBe('Super Admin');
    expect(SUPER_ADMIN_PERMISSIONS).toEqual(expect.arrayContaining([
      'manageUsers',
      'manageRoles',
      'manageSettings',
      'manageCategories',
      'manageAccounts',
      'managePaymentMethods',
      'createTransactions',
      'editTransactions',
      'voidTransactions',
      'restoreTransactions',
      'approveExpenditures',
      'generateReports',
      'exportReports',
      'viewAuditLogs',
      'manageBackups',
    ]));
  });
});
