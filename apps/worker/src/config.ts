import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const environment = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/vitrinos'),
  N8N_WEBHOOK_URL: z.string().url(),
  N8N_WEBHOOK_SECRET: z.string().min(32),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(5000),
});

const parsed = environment.safeParse(process.env);

if (!parsed.success) {
  console.error('Worker ortam değişkenleri geçersiz:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
