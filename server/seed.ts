import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getPrisma } from './db.js';
import { SUPER_ADMIN_PERMISSIONS, SUPER_ADMIN_ROLE } from './roles.js';

async function main() {
  const prisma = getPrisma();
  const email = (process.env.INITIAL_ADMIN_EMAIL ?? 'admin@school.com').trim().toLowerCase();
  const name = process.env.INITIAL_ADMIN_NAME?.trim() || 'School Administrator';
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? '';

  if (Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set INITIAL_ADMIN_PASSWORD to a unique password between 12 and 72 UTF-8 bytes before seeding.');
  }

  const superAdminRole = await prisma.role.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    update: { permissions: JSON.stringify(SUPER_ADMIN_PERMISSIONS) },
    create: {
      name: SUPER_ADMIN_ROLE,
      permissions: JSON.stringify(SUPER_ADMIN_PERMISSIONS),
    },
  });

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { email },
    update: { roleId: superAdminRole.id },
    create: {
      name,
      email,
      passwordHash,
      roleId: superAdminRole.id,
    },
  });

  await prisma.school.upsert({
    where: { id: 'default-school' },
    update: {},
    create: {
      id: 'default-school',
      name: 'Bright Future Academy',
      address: '12 School Road, Lagos, Nigeria',
      phone: '+234 800 000 0000',
      email: 'admin@school.com',
      website: 'https://brightfutureacademy.edu.ng',
      academicSession: '2025/2026',
      financialYear: '2026',
      currency: '₦',
      reportFooter: 'Prepared in accordance with school financial procedures.',
      authorizedSigner: 'Mrs. A. Okafor',
      signatoryTitle: 'School Bursar',
    },
  });

  console.log(`Empty school system initialized. Super Admin account is ready for ${email}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
