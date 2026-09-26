import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1).default('file:./data/edurewards.db'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().default(30),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  // 'none' is required when the frontend is served from a different site than
  // the API — a 'lax' cookie is never sent on cross-site requests, so sessions
  // would silently fail to refresh.
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),

  EMAIL_PROVIDER: z.enum(['console', 'smtp', 'none']).default('console'),
  EMAIL_FROM: z.string().default('EduRewards <no-reply@edurewards.local>'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(10),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be 32+ chars (used for KYC/bank data)'),

  ENABLE_JOBS: z.coerce.boolean().default(true),
  LIVENESS_CHECK_CRON_MINUTES: z.coerce.number().int().default(360),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  APP_VERSION: z.string().default('1.0.0'),
});

const parsed = envSchema
  // Browsers discard a SameSite=None cookie that is not also Secure, which
  // would leave sign-in working but every refresh failing.
  .refine((v) => v.COOKIE_SAMESITE !== 'none' || v.COOKIE_SECURE || v.NODE_ENV === 'production', {
    path: ['COOKIE_SAMESITE'],
    message: "COOKIE_SAMESITE=none requires COOKIE_SECURE=true (browsers drop the cookie otherwise)",
  })
  .safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a misconfigured environment must never boot silently.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env and fill the values.`);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
