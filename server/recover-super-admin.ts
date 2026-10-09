import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getPrisma } from './db.js';
import { SUPER_ADMIN_ROLE } from './roles.js';

async function main() {
  const email = process.env.SUPER_ADMIN_RECOVERY_EMAIL?.trim().toLowerCase() ?? '';
  const password = process.env.SUPER_ADMIN_RECOVERY_PASSWORD ?? '';
  if (!email || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set SUPER_ADMIN_RECOVERY_EMAIL and a unique SUPER_ADMIN_RECOVERY_PASSWORD (12–72 UTF-8 bytes) in a trusted environment.');
  }
  const prisma = getPrisma();
  try {
    const owner = await prisma.user.findFirst({ where: { OR: [{ isSuperAdmin: true }, { role: { name: SUPER_ADMIN_ROLE } }] }, orderBy: { createdAt: 'asc' } });
    if (!owner || owner.email.toLowerCase() !== email) throw new Error('The recovery email must exactly match the existing Super Admin account.');
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: owner.id }, data: { passwordHash, isSuperAdmin: true, status: 'active' } });
      await tx.session.updateMany({ where: { userId: owner.id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: owner.id, action: 'SUPER_ADMIN_RECOVERY', entity: 'User', entityId: owner.id, outcome: 'SUCCESS' } });
    });
    console.log(`Super Admin access recovered for ${owner.email}. Remove the recovery variables from the environment now.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
