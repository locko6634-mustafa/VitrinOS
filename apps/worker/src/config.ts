import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const environment = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/vitrinos'),
  N8N_WEBHOOK_URL: z.string().url(),
  N8N_WEBHOOK_SECRET: z.string().min(32),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_SECURE: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
  APP_URL: z.string().url().default('http://localhost:8000'),
});

const parsed = environment.safeParse(process.env);

if (!parsed.success) {
  console.error('Worker ortam değişkenleri geçersiz:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
