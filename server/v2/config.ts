import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default(3000),
  DATABASE_URL: z.string().optional().default(process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_7d1BLlsUWFRz@ep-silent-paper-azmc0w9y-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'),
  CLOUD_DATABASE_URL: z.string().optional().default(''),
  APP_URL: z.string().optional().default(''),
  DB_ENCRYPTION_KEY: z.string().optional().default(''),
  DB_ENCRYPTION_SALT: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  R2_ACCOUNT_ID: z.string().optional().default(''),
  R2_ACCESS_KEY_ID: z.string().optional().default(''),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
  R2_BUCKET_NAME: z.string().optional().default(''),
  R2_PUBLIC_URL: z.string().optional().default(''),
  REDIS_URL: z.string().optional().default(''),
  CLOUD_REDIS_URL: z.string().optional().default('')
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[CONFIG] Invalid environment variables:', parsedEnv.error.format());
  throw new Error('[CONFIG] Environment variable validation failed.');
}

export const config = parsedEnv.data;
export type Config = z.infer<typeof envSchema>;
