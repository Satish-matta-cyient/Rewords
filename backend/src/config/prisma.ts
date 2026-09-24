import { PrismaClient } from '@prisma/client';
import { env, isProd } from './env';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var __edurewardsPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__edurewardsPrisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['warn', 'error'],
  });

if (!isProd) global.__edurewardsPrisma = prisma;

/** SQLite pragmas: enforce FK integrity and use WAL for concurrent reads. */
export async function initDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');
  await prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;');
  await prisma.$executeRawUnsafe('PRAGMA busy_timeout = 5000;');
  logger.info({ url: env.DATABASE_URL }, 'database initialised');
}

export async function checkDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
