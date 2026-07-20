import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/vitrinos'),
  N8N_WEBHOOK_SECRET: z.string().min(8).default('temporary_webhook_secret_for_local_dev'),
  SESSION_SECRET: z.string().min(32).default('super_secret_session_signing_key_32_bytes_long'),
  MFA_ENCRYPTION_KEY: z.string().min(32).default('super_secret_mfa_encryption_key_32_bytes_long'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
