import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is not configured.');
	}

	prisma ??= new PrismaClient();
	return prisma;
}
