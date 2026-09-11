import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const cleanEnvStr = (val?: string) => {
  if (!val) return '';
  let cleaned = val.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '');
  // Drop channel_binding without leaving a bare "&…" query (that makes PG see
  // the database name as e.g. "neondb&sslmode=require" → SQLSTATE 3D000).
  cleaned = cleaned.replace(/([?&])channel_binding=[^&]*/g, (match, sep) => (sep === '?' ? '?' : ''));
  cleaned = cleaned.replace(/\?&/g, '?').replace(/[?&]$/g, '');
  return cleaned.replace('-pooler', '');
};

const isValidPgUrl = (str?: string) => {
  if (!str) return false;
  const cleaned = cleanEnvStr(str);
  return (cleaned.startsWith('postgres://') || cleaned.startsWith('postgresql://'));
};

const defaultLocalDbUrl = 'postgres://postgres:postgres@localhost:5432/velum';

/**
 * Railway injects RAILWAY_PUBLIC_DOMAIN, but the public hostname is not known
 * until the service exists. Fill the URL-shaped settings from it so the first
 * deploy boots without a manual round trip. Explicit values always win.
 */
const railwayDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || '').trim();
if (railwayDomain) {
  const origin = `https://${railwayDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  process.env.APP_URL ||= origin;
  process.env.WEBAUTHN_ORIGIN ||= origin;
  process.env.WEBAUTHN_RP_ID ||= new URL(origin).hostname;
}

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
    // Explicit REDIS_URL wins (local or remote). Cloud is fallback for CLI/prod when unset.
    const rawRedis = cleanEnvStr(val) || cleanEnvStr(process.env.REDIS_URL);
    if (rawRedis) {
      if (process.env.NODE_ENV === 'production' && isLocal(rawRedis)) {
        // refuse silent local redis in production; fall through to cloud
      } else {
        return rawRedis;
      }
    }
    const cloudRedis = cleanEnvStr(process.env.CLOUD_REDIS_URL);
    const upstashRedis = cleanEnvStr(process.env.UPSTASH_REDIS_URL);
    if (cloudRedis && !isLocal(cloudRedis)) return cloudRedis;
    if (upstashRedis && !isLocal(upstashRedis)) return upstashRedis;
    return '';
  }),
  CLOUD_REDIS_URL: z.string().optional().transform(cleanEnvStr).default(''),
  MESSAGE_BATCH_INTERVAL: z.string().optional().transform((val) => {
    return val ? parseInt(val, 10) : 100;
  }).default(() => 100),
  WEBAUTHN_RP_ID: z.string().optional().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().optional().default('http://localhost:3000'),
  HMAC_SECRET: z.string().optional().transform(cleanEnvStr).default(''),
  JWT_SECRET: z.string().optional().transform(cleanEnvStr).default('')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CONFIG] Invalid environment variables:', parsedEnv.error.format());
  throw new Error('[CONFIG] Environment variable validation failed.');
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;

const pointsAtLocalhost = (value: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(value);

if (config.NODE_ENV === 'production' && process.env.ALLOW_LOCALHOST_BUILD !== 'true') {
  // A silent fall back to the local dev database would run production against an empty box.
  if (config.DATABASE_URL === defaultLocalDbUrl || pointsAtLocalhost(config.DATABASE_URL)) {
    throw new Error('[CONFIG] DATABASE_URL is missing or points at localhost while NODE_ENV=production.');
  }

  if (pointsAtLocalhost(config.WEBAUTHN_RP_ID) || pointsAtLocalhost(config.WEBAUTHN_ORIGIN)) {
    throw new Error('[CONFIG] WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN must be set to the public domain while NODE_ENV=production.');
  }
}
