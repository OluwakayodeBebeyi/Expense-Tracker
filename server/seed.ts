import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getPrisma } from './db.js';
import { DEFAULT_ROLE_TEMPLATES, PERMISSIONS, SUPER_ADMIN_ROLE } from './roles.js';

async function main() {
  const prisma = getPrisma();
  try {
    const configuredEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase() ?? '';
    const configuredName = process.env.INITIAL_ADMIN_NAME?.trim() || 'School Administrator';
    const configuredPassword = process.env.INITIAL_ADMIN_PASSWORD ?? '';

    const permissionIds = new Map<string, string>();
    const newPermissionKeys = new Set<string>();
    for (const permission of PERMISSIONS) {
      const existed = await prisma.permission.findUnique({ where: { key: permission.key }, select: { id: true } });
      if (!existed) newPermissionKeys.add(permission.key);
      const saved = await prisma.permission.upsert({
        where: { key: permission.key },
        update: { module: permission.module, name: permission.name, description: permission.description, sensitive: 'sensitive' in permission ? permission.sensitive ?? false : false },
        create: { key: permission.key, module: permission.module, name: permission.name, description: permission.description, sensitive: 'sensitive' in permission ? permission.sensitive ?? false : false },
      });
      permissionIds.set(permission.key, saved.id);
    }

    const roleIds = new Map<string, string>();
    for (const template of DEFAULT_ROLE_TEMPLATES) {
      const permissions = [...template.permissions];
      const before = await prisma.role.findUnique({ where: { name: template.name }, select: { id: true, isSystem: true, permissions: true, description: true, status: true } });
      const initializeTemplate = !before || !before.isSystem || template.name === SUPER_ADMIN_ROLE;
      const saved = await prisma.role.upsert({
        where: { name: template.name },
        update: {
          description: before?.description ?? template.description,
          accessLevel: template.accessLevel,
          isSystem: template.isSystem,
          status: template.name === SUPER_ADMIN_ROLE ? 'active' : before?.status ?? 'active',
          permissions: initializeTemplate ? JSON.stringify(permissions) : before.permissions,
        },
        create: { name: template.name, description: template.description, accessLevel: template.accessLevel, isSystem: template.isSystem, status: 'active', permissions: JSON.stringify(permissions) },
      });
      roleIds.set(template.name, saved.id);
      let storedPermissionKeys: string[] = [];
      try {
        const parsed: unknown = JSON.parse(before?.permissions ?? '[]');
        if (Array.isArray(parsed)) storedPermissionKeys = parsed.filter((value): value is string => typeof value === 'string');
      } catch { /* An unreadable legacy value contributes no permission grants. */ }
      if (initializeTemplate) {
        await prisma.$transaction(async (tx) => {
          await tx.rolePermission.deleteMany({ where: { roleId: saved.id } });
          if (permissions.length) {
            await tx.rolePermission.createMany({ data: permissions.map((key) => ({ roleId: saved.id, permissionId: permissionIds.get(key)! })) });
          }
        });
      } else {
        const additions = permissions.filter((key) => newPermissionKeys.has(key));
        if (additions.length) {
          await prisma.$transaction(async (tx) => {
            await tx.rolePermission.createMany({ data: additions.map((key) => ({ roleId: saved.id, permissionId: permissionIds.get(key)! })), skipDuplicates: true });
            await tx.role.update({ where: { id: saved.id }, data: { permissions: JSON.stringify([...new Set([...storedPermissionKeys, ...additions])]) } });
          });
        }
      }
    }

    const legacyPermissionMap: Record<string, string[]> = {
      manageUsers: ['users.view', 'users.create', 'users.update', 'users.suspend'],
      manageRoles: ['roles.view', 'roles.create', 'roles.update'],
      manageSettings: ['school_settings.manage'],
      manageCategories: ['categories.view', 'categories.manage'],
      manageAccounts: ['accounts.view', 'accounts.manage'],
      managePaymentMethods: ['payment_methods.view', 'payment_methods.manage'],
      createTransactions: ['transactions.create'],
      editTransactions: ['transactions.update'],
      manageTransactions: ['transactions.update'],
      approveExpenditures: ['transactions.approve'],
      voidTransactions: ['transactions.void'],
      restoreTransactions: ['transactions.restore'],
      generateReports: ['reports.view'],
      exportReports: ['reports.export'],
      viewAuditLogs: ['audit_logs.view'],
      manageAttachments: ['transactions.view'],
    };
    const templateNames = DEFAULT_ROLE_TEMPLATES.map((template) => template.name);
    const otherRoles = await prisma.role.findMany({ where: { name: { notIn: templateNames } }, select: { id: true, permissions: true } });
    for (const role of otherRoles) {
      let previousKeys: string[] = [];
      try { const parsed: unknown = JSON.parse(role.permissions); if (Array.isArray(parsed)) previousKeys = parsed.filter((value): value is string => typeof value === 'string'); } catch { /* Unknown legacy content grants no new permissions. */ }
      const migratedKeys = [...new Set(previousKeys.flatMap((key) => legacyPermissionMap[key] ?? []))];
      const grants = migratedKeys.map((key) => ({ key, id: permissionIds.get(key) })).filter((item): item is { key: string; id: string } => Boolean(item.id));
      await prisma.$transaction(async (tx) => {
        if (grants.length) {
          await tx.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, permissionId: grant.id })), skipDuplicates: true });
          await tx.role.update({ where: { id: role.id }, data: { permissions: JSON.stringify([...new Set([...previousKeys.filter((key) => !legacyPermissionMap[key]), ...grants.map((grant) => grant.key)])]) } });
        }
      });
    }

    const superAdminRoleId = roleIds.get(SUPER_ADMIN_ROLE)!;
    let owner = await prisma.user.findFirst({ where: { OR: [{ isSuperAdmin: true }, { role: { name: SUPER_ADMIN_ROLE } }] }, orderBy: { createdAt: 'asc' } });
    if (owner) {
      if (owner.roleId !== superAdminRoleId || !owner.isSuperAdmin) {
        owner = await prisma.user.update({ where: { id: owner.id }, data: { roleId: superAdminRoleId, isSuperAdmin: true } });
      }
      if (configuredEmail && configuredEmail !== owner.email) {
        console.warn(`Preserving existing Super Admin account ${owner.email}; INITIAL_ADMIN_EMAIL was not used.`);
      }
      console.log(`Preserved existing Super Admin account ${owner.email}.`);
    } else {
      if (!configuredEmail || configuredEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)) {
        throw new Error('Set INITIAL_ADMIN_EMAIL to a valid administrator email before provisioning the Super Admin.');
      }
      const existing = await prisma.user.findUnique({ where: { email: configuredEmail } });
      if (!existing && (Buffer.byteLength(configuredPassword, 'utf8') < 12 || Buffer.byteLength(configuredPassword, 'utf8') > 72)) {
        throw new Error('Set INITIAL_ADMIN_PASSWORD to a unique password between 12 and 72 UTF-8 bytes before provisioning a new Super Admin.');
      }
      const passwordHash = existing ? undefined : await bcrypt.hash(configuredPassword, 12);
      owner = await prisma.user.upsert({
        where: { email: configuredEmail },
        update: { roleId: superAdminRoleId, isSuperAdmin: true },
        create: { name: configuredName, email: configuredEmail, passwordHash: passwordHash!, roleId: superAdminRoleId, isSuperAdmin: true },
      });
      console.log(`Initial Super Admin is ready for ${owner.email}.`);
    }

    await prisma.school.upsert({
      where: { id: 'default-school' },
      update: {},
      create: {
        id: 'default-school',
        name: process.env.SCHOOL_NAME?.trim() || 'School Name',
        currency: process.env.SCHOOL_CURRENCY?.trim() || '₦',
        academicSession: process.env.SCHOOL_ACADEMIC_SESSION?.trim() || null,
        financialYear: process.env.SCHOOL_FINANCIAL_YEAR?.trim() || null,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
