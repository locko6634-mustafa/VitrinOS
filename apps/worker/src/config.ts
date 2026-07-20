import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/vitrinos'),
  N8N_WEBHOOK_URL: z.string().url().default('https://server.n8n-mustafa.me/webhook/vitrinos-brief'),
  N8N_WEBHOOK_SECRET: z.string().min(8).default('temporary_webhook_secret_for_local_dev'),
  INTERNAL_API_TOKEN: z.string().min(16).default('super_secret_internal_api_token_for_n8n_and_worker'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Worker environment variables are invalid:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
