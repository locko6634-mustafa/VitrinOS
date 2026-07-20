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
    S3_ENDPOINT: z.string().url().optional(),
    S3_ACCESS_KEY_ID: z.string().default('mock_access_key'),
    S3_SECRET_ACCESS_KEY: z.string().default('mock_secret_key'),
    S3_BUCKET_NAME: z.string().default('vitrinos-assets'),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    INTERNAL_API_TOKEN: z.string().min(16).default('super_secret_internal_api_token_for_n8n_and_worker'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    process.exit(1);
}
export const config = parsed.data;
//# sourceMappingURL=config.js.map