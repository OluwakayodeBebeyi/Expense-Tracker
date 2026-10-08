export const SUPER_ADMIN_ROLE = 'Super Admin';

export const SUPER_ADMIN_PERMISSIONS = [
  'manageUsers',
  'manageRoles',
  'manageSettings',
  'manageCategories',
  'manageAccounts',
  'managePaymentMethods',
  'createTransactions',
  'editTransactions',
  'manageTransactions',
  'approveExpenditures',
  'voidTransactions',
  'restoreTransactions',
  'generateReports',
  'exportReports',
  'viewAuditLogs',
  'manageBackups',
  'manageAttachments',
] as const;