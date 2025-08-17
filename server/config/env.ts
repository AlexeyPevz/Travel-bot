import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  APP_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).optional(),
  LOG_TO_FILES: z.enum(['true', 'false']).optional(),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  JWT_ISSUER: z.string().default('ai-travel-agent'),
  JWT_AUDIENCE: z.string().default('ai-travel-agent-api'),

  // Telegram
  TELEGRAM_TOKEN: z.string().optional(),
  TELEGRAM_USE_WEBHOOK: z.enum(['true', 'false']).optional(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0'),

  // Database
  DATABASE_URL: z.string().url(),

  // Security
  CSRF_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().optional(),
  COOKIE_SECRET: z.string().optional(),

  // Metrics protection
  METRICS_BASIC_AUTH: z.string().optional(), // user:pass
  METRICS_IP_ALLOWLIST: z.string().optional(), // comma separated

  // Feature flags
  ENABLE_BACKGROUND_SEARCH: z.enum(['true', 'false']).optional(),
  ENABLE_SMART_RANKING: z.enum(['true', 'false']).optional(),
  ENABLE_NEW_PROFILE: z.enum(['true', 'false']).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return parsed.data;
}