import { FastifyPluginAsync } from 'fastify';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { and, assets, brandPrompts, brands, eq, jobAttempts, jobEvents, jobs, sql } from '@vitrinos/db';
import { config } from '../config.js';
import { getPresignedDownloadUrl, getPresignedUploadUrl, s3Client } from '../utils/s3.js';

const outputMetadata = z.object({
  mimeType: z.string().regex(/^image\/(jpeg|png|webp)$/),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  checksum: z.string().min(8).max(256),
});
const resultBody = outputMetadata.extend({ key: z.string().min(1) });
const failBody = z.object({ errorPayload: z.record(z.unknown()).optional(), isRetryable: z.boolean().default(false) });

function outputKey(attemptId: string, mimeType: string): string {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  return `generated-assets/${attemptId}/output.${extension}`;
}

export const internalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', async (request, reply) => {
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Dahili API yetkilendirmesi eksik' });
    if (token !== config.INTERNAL_API_TOKEN) return reply.code(403).send({ code: 'FORBIDDEN', message: 'Geçersiz dahili API token' });
  });

  const notify = async (jobId: string, status: string, ownerId: string) => {
    const payload = JSON.stringify({ jobId, status, ownerId, timestamp: new Date().toISOString() });
    await fastify.db.execute(sql`SELECT pg_notify('job_updates', ${payload})`);
  };

  fastify.post('/api/v1/internal/v1/n8n/attempts/:attemptId/claim', async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const attempt = await fastify.db.query.jobAttempts.findFirst({ where: eq(jobAttempts.id, attemptId) });
    if (!attempt) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
    if (['succeeded', 'cancelled', 'failed_retryable', 'failed_terminal'].includes(attempt.status)) {
      return reply.code(409).send({ code: 'INVALID_STATUS', message: 'Bu deneme sonuçlandırılmış' });
    }
    const job = await fastify.db.query.jobs.findFirst({ where: eq(jobs.id, attempt.jobId) });
    if (!job) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
    if (job.status === 'cancelled') return reply.code(409).send({ code: 'JOB_CANCELLED', message: 'İş iptal edilmiş' });

    if (attempt.status !== 'processing') {
      const transitioned = await fastify.db.transaction(async (tx) => {
        const updated = await tx.update(jobAttempts)
          .set({ status: 'processing', updatedAt: new Date() })
          .where(and(eq(jobAttempts.id, attemptId), sql`${jobAttempts.status} IN ('queued', 'dispatching')`))
          .returning({ id: jobAttempts.id });
        if (updated.length === 0) return false;
        await tx.update(jobs).set({ status: 'processing', updatedAt: new Date() }).where(eq(jobs.id, job.id));
        await tx.insert(jobEvents).values({ jobId: job.id, eventType: 'status_changed', payload: { status: 'processing', attemptId } });
        return true;
      });
      if (transitioned) await notify(job.id, 'processing', job.ownerId);
    }

    const brand = await fastify.db.query.brands.findFirst({ where: eq(brands.id, job.brandId) });
    const prompts = await fastify.db.query.brandPrompts.findFirst({ where: eq(brandPrompts.brandId, job.brandId) });
    return reply.send({ data: {
      jobId: job.id, attemptId, briefText: job.briefText, format: job.format, imageId: job.imageId,
      brand: brand && { name: brand.name, colorPalette: brand.colorPalette, toneRules: brand.toneRules, bannedWords: brand.bannedWords },
      prompts: prompts && { basePrompt: prompts.basePrompt, bannerPrompt: prompts.bannerPrompt, metaPostPrompt: prompts.metaPostPrompt, storyPrompt: prompts.storyPrompt, revizePrompt: prompts.revizePrompt },
    } });
  });

  fastify.post('/api/v1/internal/v1/n8n/attempts/:attemptId/output-upload-url', async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const metadata = outputMetadata.parse(request.body);
    const attempt = await fastify.db.query.jobAttempts.findFirst({ where: eq(jobAttempts.id, attemptId) });
    if (!attempt || attempt.status !== 'processing') return reply.code(409).send({ code: 'ATTEMPT_NOT_PROCESSING', message: 'Aktif deneme gerekli' });
    const key = outputKey(attemptId, metadata.mimeType);
    return reply.send({ data: { key, uploadUrl: await getPresignedUploadUrl(key, metadata.mimeType, 900), expiresInSeconds: 900 } });
  });

  fastify.get('/api/v1/internal/v1/n8n/assets/:assetId/content', async (request, reply) => {
    const { assetId } = request.params as { assetId: string };
    const asset = await fastify.db.query.assets.findFirst({ where: eq(assets.id, assetId) });
    if (!asset || asset.status !== 'active') return reply.code(404).send({ code: 'NOT_FOUND', message: 'Asset bulunamadı' });
    return reply.code(302).redirect(await getPresignedDownloadUrl(asset.key, 900));
  });

  fastify.put('/api/v1/internal/v1/n8n/attempts/:attemptId/result', async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const body = resultBody.parse(request.body);
    const attempt = await fastify.db.query.jobAttempts.findFirst({ where: eq(jobAttempts.id, attemptId) });
    if (!attempt) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
    const previous = attempt.resultPayload as { checksum?: string } | null;
    if (attempt.status === 'succeeded') {
      if (previous?.checksum === body.checksum) return reply.send({ success: true, idempotent: true });
      return reply.code(409).send({ code: 'RESULT_CONFLICT', message: 'Aynı deneme için farklı çıktı gönderildi' });
    }
    if (attempt.status !== 'processing') return reply.code(409).send({ code: 'ATTEMPT_NOT_PROCESSING', message: 'Bu deneme sonuç kabul etmiyor' });
    if (body.key !== outputKey(attemptId, body.mimeType)) return reply.code(400).send({ code: 'INVALID_OUTPUT_KEY', message: 'Çıktı anahtarı denemeyle eşleşmiyor' });
    const job = await fastify.db.query.jobs.findFirst({ where: eq(jobs.id, attempt.jobId) });
    if (!job) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
    try {
      const object = await s3Client.send(new HeadObjectCommand({ Bucket: config.S3_BUCKET_NAME, Key: body.key }));
      if (object.ContentLength !== body.sizeBytes || object.ContentType !== body.mimeType) return reply.code(400).send({ code: 'OUTPUT_METADATA_MISMATCH', message: 'Çıktı metadatası doğrulanamadı' });
    } catch {
      return reply.code(400).send({ code: 'OUTPUT_NOT_FOUND', message: 'Çıktı depolamada bulunamadı' });
    }
    const [asset] = await fastify.db.transaction(async (tx) => {
      const created = await tx.insert(assets).values({ key: body.key, bucket: config.S3_BUCKET_NAME, ownerId: job.ownerId, mimeType: body.mimeType, sizeBytes: body.sizeBytes, checksum: body.checksum, purpose: 'generated_asset', status: 'active' }).returning();
      await tx.update(jobAttempts).set({ status: 'succeeded', resultPayload: { assetId: created[0].id, key: body.key, checksum: body.checksum }, updatedAt: new Date() }).where(eq(jobAttempts.id, attemptId));
      await tx.update(jobs).set({ status: 'succeeded', imageId: created[0].id, imageUrl: body.key, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      await tx.insert(jobEvents).values({ jobId: job.id, eventType: 'status_changed', payload: { status: 'succeeded', attemptId, assetId: created[0].id } });
      return created;
    });
    await notify(job.id, 'succeeded', job.ownerId);
    return reply.send({ success: true, data: { assetId: asset.id } });
  });

  fastify.post('/api/v1/internal/v1/n8n/attempts/:attemptId/fail', async (request, reply) => {
    const { attemptId } = request.params as { attemptId: string };
    const body = failBody.parse(request.body);
    const attempt = await fastify.db.query.jobAttempts.findFirst({ where: eq(jobAttempts.id, attemptId) });
    if (!attempt) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
    if (['succeeded', 'cancelled'].includes(attempt.status)) return reply.code(409).send({ code: 'INVALID_STATUS', message: 'Deneme sonuçlandırılmış' });
    const job = await fastify.db.query.jobs.findFirst({ where: eq(jobs.id, attempt.jobId) });
    if (!job) return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
    const status = body.isRetryable ? 'failed_retryable' : 'failed_terminal';
    await fastify.db.transaction(async (tx) => {
      await tx.update(jobAttempts).set({ status, errorPayload: body.errorPayload ?? null, updatedAt: new Date() }).where(eq(jobAttempts.id, attemptId));
      await tx.update(jobs).set({ status, updatedAt: new Date() }).where(eq(jobs.id, job.id));
      await tx.insert(jobEvents).values({ jobId: job.id, eventType: 'status_changed', payload: { status, attemptId } });
    });
    await notify(job.id, status, job.ownerId);
    return reply.send({ success: true });
  });

  fastify.post('/api/v1/internal/v1/n8n/executions/:executionId/fail', async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    fastify.log.error({ executionId, body: request.body }, 'n8n workflow failure');
    return reply.send({ success: true });
  });
};
