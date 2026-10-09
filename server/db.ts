import { Prisma, PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;
const transientDatabaseCodes = new Set(['P1001', 'P1002', 'P1017']);

export function resolveDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
	const databaseUrl = [
		environment.DATABASE_URL,
		environment.POSTGRES_PRISMA_URL,
		environment.POSTGRES_URL,
		environment.DATABASE_POSTGRES_PRISMA_URL,
	].map((value) => value?.trim()).find(Boolean);
	if (!databaseUrl) {
		throw new Error('No supported PostgreSQL connection URL is configured. Set DATABASE_URL.');
	}

	return databaseUrl;
}

export function getPrisma(): PrismaClient {
	const databaseUrl = resolveDatabaseUrl();
	prisma ??= new PrismaClient({ datasources: { db: { url: databaseUrl } } });
	return prisma;
}

export async function withDatabaseRetry<T>(operation: () => Promise<T>): Promise<T> {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await operation();
		} catch (error) {
			const isTransientInitialization = error instanceof Prisma.PrismaClientInitializationError
				&& transientDatabaseCodes.has(error.errorCode ?? '');
			const isTransientRequest = error instanceof Prisma.PrismaClientKnownRequestError
				&& transientDatabaseCodes.has(error.code);
			if ((!isTransientInitialization && !isTransientRequest) || attempt >= 2) throw error;
			await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
		}
	}
}
