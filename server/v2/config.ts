import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const cleanEnvStr = (val?: string) => {
  if (!val) return '';
  const cleaned = val.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '').replace(/(&|\?)channel_binding=[^&]+/g, '');
  return cleaned;
};

const isValidPgUrl = (str?: string) => {
  if (!str) return false;
  const cleaned = cleanEnvStr(str);
  return (cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://'));
};

const defaultLocalDbUrl = 'postgres://postgres:postgres@localhost:5432/velum';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default(3000),
  DATABASE_URL: z.string().optional().transform((val) => {
    const raw = cleanEnvStr(val);
    if (isValidPgUrl(raw)) return raw;
    const envDb = cleanEnvStr(process.env.DATABASE_URL);
    if (isValidPgUrl(envDb)) return envDb;
    const cloudDb = cleanEnvStr(process.env.CLOUD_DATABASE_URL);
    if (isValidPgUrl(cloudDb)) return cloudDb;
    return defaultLocalDbUrl;
  }),
  CLOUD_DATABASE_URL: z.string().optional().transform(cleanEnvStr).default(''),
  APP_URL: z.string().optional().default(''),
  DB_ENCRYPTION_KEY: z.string().optional().default(''),
  DB_ENCRYPTION_SALT: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().optional().default(''),
  R2_PUBLIC_URL: z.string().optional().default(''),
  REDIS_URL: z.string().optional().transform((val) => {
    const isLocal = (url: string) => url.includes('localhost') || url.includes('127.0.0.1');
    const cloudRedis = cleanEnvStr(process.env.CLOUD_REDIS_URL);
    const upstashRedis = cleanEnvStr(process.env.UPSTASH_REDIS_URL);
    if (cloudRedis && !isLocal(cloudRedis)) return cloudRedis;
    if (upstashRedis && !isLocal(upstashRedis)) return upstashRedis;

    const rawRedis = cleanEnvStr(val) || cleanEnvStr(process.env.REDIS_URL);
    if (rawRedis && !isLocal(rawRedis)) {
      return rawRedis;
    }
    return cloudRedis || upstashRedis || '';
  }),
  CLOUD_REDIS_URL: z.string().optional().transform(cleanEnvStr).default(''),
  MESSAGE_BATCH_INTERVAL: z.string().optional().transform((val) => {
    return val ? parseInt(val, 10) : 100;
  }).default(() => 100)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CONFIG] Invalid environment variables:', parsedEnv.error.format());
  throw new Error('[CONFIG] Environment variable validation failed.');
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
