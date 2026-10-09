export const SUPER_ADMIN_ROLE = 'Super Admin';

export const PERMISSIONS = [
  { key: 'dashboard.view', module: 'dashboard', name: 'View dashboard', description: 'View permitted dashboard summaries.' },
  { key: 'users.view', module: 'users', name: 'View users', description: 'Search and view user accounts.' },
  { key: 'users.create', module: 'users', name: 'Create users', description: 'Create ordinary user accounts.', sensitive: true },
  { key: 'users.update', module: 'users', name: 'Edit users', description: 'Edit ordinary user details and assignments.', sensitive: true },
  { key: 'users.suspend', module: 'users', name: 'Suspend users', description: 'Suspend or reactivate ordinary accounts.', sensitive: true },
  { key: 'users.delete', module: 'users', name: 'Delete users', description: 'Delete eligible ordinary user accounts.', sensitive: true },
  { key: 'roles.view', module: 'roles', name: 'View roles', description: 'View roles and their permissions.' },
  { key: 'roles.create', module: 'roles', name: 'Create roles', description: 'Create custom roles.', sensitive: true },
  { key: 'roles.update', module: 'roles', name: 'Edit roles', description: 'Edit eligible custom roles.', sensitive: true },
  { key: 'roles.delete', module: 'roles', name: 'Delete roles', description: 'Delete unused custom roles.', sensitive: true },
  { key: 'permissions.assign', module: 'permissions', name: 'Assign permissions', description: 'Assign permissions within the actor’s own authority.', sensitive: true },
  { key: 'transactions.view', module: 'transactions', name: 'View transactions', description: 'View transaction records.' },
  { key: 'transactions.create', module: 'transactions', name: 'Create transactions', description: 'Create pending transactions.', sensitive: true },
  { key: 'transactions.update', module: 'transactions', name: 'Edit transactions', description: 'Edit pending or rejected transactions.', sensitive: true },
  { key: 'transactions.approve', module: 'transactions', name: 'Approve transactions', description: 'Approve pending transactions.', sensitive: true },
  { key: 'transactions.reject', module: 'transactions', name: 'Reject transactions', description: 'Reject pending transactions.', sensitive: true },
  { key: 'transactions.void', module: 'transactions', name: 'Void transactions', description: 'Void approved transactions.', sensitive: true },
  { key: 'transactions.restore', module: 'transactions', name: 'Restore transactions', description: 'Restore voided transactions.', sensitive: true },
  { key: 'accounts.view', module: 'accounts', name: 'View accounts', description: 'View financial accounts.' },
  { key: 'accounts.manage', module: 'accounts', name: 'Manage accounts', description: 'Create and edit financial accounts.', sensitive: true },
  { key: 'payment_methods.view', module: 'payment_methods', name: 'View payment methods', description: 'View payment method options.' },
  { key: 'payment_methods.manage', module: 'payment_methods', name: 'Manage payment methods', description: 'Create and edit payment method options.', sensitive: true },
  { key: 'categories.view', module: 'categories', name: 'View categories', description: 'View transaction categories.' },
  { key: 'categories.manage', module: 'categories', name: 'Manage categories', description: 'Create and edit transaction categories.', sensitive: true },
  { key: 'reports.view', module: 'reports', name: 'View reports', description: 'View reports and analytics.' },
  { key: 'reports.export', module: 'reports', name: 'Export reports', description: 'Export permitted reports.' },
  { key: 'audit_logs.view', module: 'audit_logs', name: 'View audit logs', description: 'Review security and administrative events.', sensitive: true },
  { key: 'school_settings.manage', module: 'settings', name: 'Manage school settings', description: 'Edit school identity and finance settings.', sensitive: true },
  { key: 'system_settings.manage', module: 'settings', name: 'Manage system security', description: 'Edit system-wide access policies and security controls.', sensitive: true },
  { key: 'sessions.manage', module: 'sessions', name: 'Manage sessions', description: 'Revoke user sessions.' , sensitive: true },
] as const;

export type PermissionKey = typeof PERMISSIONS[number]['key'];
export const ALL_PERMISSION_KEYS = PERMISSIONS.map((permission) => permission.key) as PermissionKey[];
export const SUPER_ADMIN_PERMISSIONS = ALL_PERMISSION_KEYS;

const pick = (...keys: PermissionKey[]): PermissionKey[] => keys;

export const DEFAULT_ROLE_TEMPLATES = [
  { name: SUPER_ADMIN_ROLE, description: 'System owner with complete authority.', accessLevel: 100, isSystem: true, permissions: ALL_PERMISSION_KEYS },
  { name: 'Admin', description: 'School administrator; cannot control the system owner or grant unheld permissions.', accessLevel: 80, isSystem: true, permissions: PERMISSIONS.filter((permission) => !['system_settings.manage', 'users.delete'].includes(permission.key)).map((permission) => permission.key) },
  { name: 'Accountant / Bursar', description: 'Review financial records and reporting; transaction workflow access is reserved for Admin, Financial Secretary/Treasurer, and the protected Super Admin.', accessLevel: 60, isSystem: true, permissions: pick('dashboard.view', 'transactions.view', 'accounts.view', 'categories.view', 'payment_methods.view', 'reports.view', 'reports.export') },
  { name: 'Financial Secretary', description: 'Manage financial records and reporting.', accessLevel: 60, isSystem: true, permissions: pick('dashboard.view', 'transactions.view', 'transactions.create', 'transactions.update', 'transactions.approve', 'transactions.reject', 'transactions.void', 'transactions.restore', 'accounts.view', 'categories.view', 'payment_methods.view', 'reports.view', 'reports.export') },
  { name: 'Treasurer', description: 'Manage financial records and reporting.', accessLevel: 60, isSystem: true, permissions: pick('dashboard.view', 'transactions.view', 'transactions.create', 'transactions.update', 'transactions.approve', 'transactions.reject', 'transactions.void', 'transactions.restore', 'accounts.view', 'categories.view', 'payment_methods.view', 'reports.view', 'reports.export') },
  { name: 'Auditor', description: 'Read financial records and audit history.', accessLevel: 50, isSystem: true, permissions: pick('dashboard.view', 'transactions.view', 'accounts.view', 'categories.view', 'payment_methods.view', 'reports.view', 'reports.export', 'audit_logs.view') },
  { name: 'Management / Viewer', description: 'Read-only dashboard and reporting access.', accessLevel: 10, isSystem: true, permissions: pick('dashboard.view', 'reports.view') },
] as const;

export function hasPermission(granted: readonly string[], required: string): boolean {
  return granted.includes(required);
}

export function isTransactionManagerRole(roleName: string, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  const role = roleName.trim().toLowerCase().replace(/\s+/g, ' ');
  return new Set(['admin', 'administrator', 'financial secretary', 'treasurer', 'financial secretary/treasurer', 'financial secretary / treasurer']).has(role);
}
