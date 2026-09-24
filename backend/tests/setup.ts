import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, afterAll } from 'vitest';

// Tests run against a disposable SQLite file so the development database is untouched.
const TEST_DB = path.resolve(process.cwd(), 'data/test.db');

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = `file:${TEST_DB}`;
process.env.JWT_SECRET = 'test-jwt-secret-value-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-value-0123456789';
process.env.ENCRYPTION_KEY = 'test-encryption-key-that-is-long-enough-32';
process.env.ENABLE_JOBS = 'false';
process.env.EMAIL_PROVIDER = 'none';
process.env.LOG_LEVEL = 'error';

beforeAll(() => {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = `${TEST_DB}${suffix}`;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB}` },
  });
});

afterAll(async () => {
  const { prisma } = await import('../src/config/prisma');
  await prisma.$disconnect();
});
