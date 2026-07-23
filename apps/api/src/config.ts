import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const productionSecrets = [
  'DATABASE_URL',
  'N8N_WEBHOOK_SECRET',
  'SESSION_SECRET',
  'MFA_ENCRYPTION_KEY',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'INTERNAL_API_TOKEN',
] as const;

if (process.env.NODE_ENV === 'production') {
  const missing = productionSecrets.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Production ortamında zorunlu yapılandırmalar eksik: ${missing.join(', ')}`);
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/vitrinos'),
  N8N_WEBHOOK_SECRET: z.string().min(8).default('temporary_webhook_secret_for_local_dev'),
  SESSION_SECRET: z.string().min(32).default('super_secret_session_signing_key_32_bytes_long'),
  MFA_ENCRYPTION_KEY: z.string().min(32).default('super_secret_mfa_encryption_key_32_bytes_long'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().default('mock_access_key'),
  S3_SECRET_ACCESS_KEY: z.string().default('mock_secret_key'),
  S3_BUCKET_NAME: z.string().default('vitrinos-assets'),
  S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  INTERNAL_API_TOKEN: z.string().min(16).default('super_secret_internal_api_token_for_n8n_and_worker'),
  PUBLIC_API_BASE_URL: z.string().startsWith('/').default('/api/v1'),
  PUBLIC_APP_BASE_PATH: z.string().startsWith('/').default('/'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
