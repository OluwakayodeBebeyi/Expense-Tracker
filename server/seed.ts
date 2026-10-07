import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

async function main() {
  const defaultRole = await prisma.role.upsert({
    where: { name: 'Administrator' },
    update: {},
    create: {
      name: 'Administrator',
      permissions: JSON.stringify(['manageUsers', 'manageSettings', 'manageTransactions', 'generateReports']),
    },
  });

  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@school.com' },
    update: {},
    create: {
      name: 'School Administrator',
      email: 'admin@school.com',
      passwordHash,
      roleId: defaultRole.id,
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

  const incomeCategory = await prisma.category.upsert({
    where: { id: 'income-default' },
    update: {},
    create: {
      id: 'income-default',
      name: 'School Fees',
      type: 'INCOME',
      description: 'Default income category',
      status: 'active',
    },
  });

  const expenseCategory = await prisma.category.upsert({
    where: { id: 'expense-default' },
    update: {},
    create: {
      id: 'expense-default',
      name: 'Salaries',
      type: 'EXPENDITURE',
      description: 'Default expenditure category',
      status: 'active',
    },
  });

  const paymentMethod = await prisma.paymentMethod.upsert({
    where: { name: 'Bank Transfer' },
    update: {},
    create: { name: 'Bank Transfer', status: 'active' },
  });

  const account = await prisma.account.upsert({
    where: { id: 'main-bank' },
    update: {},
    create: {
      id: 'main-bank',
      name: 'Main School Account',
      type: 'bank',
      bankName: 'First Bank',
      accountNumber: '1234567890',
      openingBalance: 2500000,
      currentBalance: 2500000,
      status: 'active',
    },
  });

  const now = new Date();

  await prisma.transaction.upsert({
    where: { transactionId: 'INC-2026-000001' },
    update: {},
    create: {
      transactionId: 'INC-2026-000001',
      type: 'INCOME',
      date: now,
      categoryId: incomeCategory.id,
      description: 'School fees collection',
      amount: 250000,
      paymentMethodId: paymentMethod.id,
      accountId: account.id,
      sourceOrVendor: 'Parents',
      referenceNumber: 'REF-001',
      academicSession: '2025/2026',
      financialYear: '2026',
      status: 'approved',
      approvalStatus: 'approved',
      createdById: (await prisma.user.findUnique({ where: { email: 'admin@school.com' } }))!.id,
      approvedById: (await prisma.user.findUnique({ where: { email: 'admin@school.com' } }))!.id,
    },
  });

  await prisma.transaction.upsert({
    where: { transactionId: 'EXP-2026-000001' },
    update: {},
    create: {
      transactionId: 'EXP-2026-000001',
      type: 'EXPENDITURE',
      date: now,
      categoryId: expenseCategory.id,
      description: 'Teacher salary payment',
      amount: 180000,
      paymentMethodId: paymentMethod.id,
      accountId: account.id,
      sourceOrVendor: 'Staff Payroll',
      referenceNumber: 'EXP-REF-001',
      academicSession: '2025/2026',
      financialYear: '2026',
      status: 'approved',
      approvalStatus: 'approved',
      createdById: (await prisma.user.findUnique({ where: { email: 'admin@school.com' } }))!.id,
      approvedById: (await prisma.user.findUnique({ where: { email: 'admin@school.com' } }))!.id,
    },
  });

  console.log('Seed data created successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
