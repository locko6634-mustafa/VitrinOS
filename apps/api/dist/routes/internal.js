import { z } from 'zod';
import { jobs, jobAttempts, jobEvents, brands, brandPrompts, assets, eq, sql } from '@vitrinos/db';
import { getPresignedDownloadUrl } from '../utils/s3.js';
import { config } from '../config.js';
const ResultRequestSchema = z.object({
    key: z.string().min(1, 'Key zorunludur'),
    mimeType: z.string().min(1, 'MimeType zorunludur'),
    sizeBytes: z.number().min(1, 'SizeBytes zorunludur'),
    checksum: z.string().min(1, 'Checksum zorunludur'),
});
const FailRequestSchema = z.object({
    errorPayload: z.any().optional(),
    isRetryable: z.boolean().default(false),
});
export const internalRoutes = async (fastify) => {
    // n8n Bearer Token doğrulaması
    fastify.addHook('preHandler', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Dahili API yetkilendirmesi eksik' });
        }
        const token = authHeader.split(' ')[1];
        if (token !== config.INTERNAL_API_TOKEN) {
            return reply.code(403).send({ code: 'FORBIDDEN', message: 'Geçersiz dahili API token' });
        }
    });
    // Helper: Durum güncelleme ve NOTIFY yayını
    const notifyJobUpdate = async (jobId, status, ownerId) => {
        const payload = JSON.stringify({ jobId, status, ownerId, timestamp: new Date().toISOString() });
        await fastify.db.execute(sql `SELECT pg_notify('job_updates', ${payload})`);
    };
    // POST /api/v1/internal/v1/n8n/attempts/:attemptId/claim
    fastify.post('/api/v1/internal/v1/n8n/attempts/:attemptId/claim', async (request, reply) => {
        const { attemptId } = request.params;
        const attempt = await fastify.db.query.jobAttempts.findFirst({
            where: eq(jobAttempts.id, attemptId),
        });
        if (!attempt) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
        }
        // Eğer zaten succeeded veya cancelled ise claim edilmesine izin verme
        if (['succeeded', 'cancelled'].includes(attempt.status)) {
            return reply.code(400).send({ code: 'INVALID_STATUS', message: 'Bu deneme zaten sonuçlandırılmış' });
        }
        const job = await fastify.db.query.jobs.findFirst({
            where: eq(jobs.id, attempt.jobId),
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
        }
        // Atomik durum güncellemesi (processing)
        await fastify.db.transaction(async (tx) => {
            await tx.update(jobAttempts)
                .set({ status: 'processing', updatedAt: new Date() })
                .where(eq(jobAttempts.id, attemptId));
            await tx.update(jobs)
                .set({ status: 'processing', updatedAt: new Date() })
                .where(eq(jobs.id, job.id));
            await tx.insert(jobEvents).values({
                jobId: job.id,
                eventType: 'status_changed',
                payload: { status: 'processing', attemptId },
            });
        });
        // Marka ve prompt bilgilerini yükle
        const brandInfo = await fastify.db.query.brands.findFirst({
            where: eq(brands.id, job.brandId),
        });
        const promptInfo = await fastify.db.query.brandPrompts.findFirst({
            where: eq(brandPrompts.brandId, job.brandId),
        });
        // SSE yayını
        await notifyJobUpdate(job.id, 'processing', job.ownerId);
        return reply.send({
            data: {
                jobId: job.id,
                attemptId,
                briefText: job.briefText,
                format: job.format,
                imageId: job.imageId,
                revisionCount: job.revisionCount,
                brand: brandInfo ? {
                    name: brandInfo.name,
                    colorPalette: brandInfo.colorPalette,
                    toneRules: brandInfo.toneRules,
                    bannedWords: brandInfo.bannedWords,
                } : null,
                prompts: promptInfo ? {
                    basePrompt: promptInfo.basePrompt,
                    bannerPrompt: promptInfo.bannerPrompt,
                    metaPostPrompt: promptInfo.metaPostPrompt,
                    storyPrompt: promptInfo.storyPrompt,
                    revizePrompt: promptInfo.revizePrompt,
                } : null,
            }
        });
    });
    // GET /api/v1/internal/v1/n8n/assets/:assetId/content
    fastify.get('/api/v1/internal/v1/n8n/assets/:assetId/content', async (request, reply) => {
        const { assetId } = request.params;
        const asset = await fastify.db.query.assets.findFirst({
            where: eq(assets.id, assetId),
        });
        if (!asset || asset.status !== 'active') {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'Asset bulunamadı veya aktif değil' });
        }
        // Kısa ömürlü (15 dk) indirme presigned URL'si üret ve redirect et
        const downloadUrl = await getPresignedDownloadUrl(asset.key, 900);
        return reply.code(302).redirect(downloadUrl);
    });
    // PUT /api/v1/internal/v1/n8n/attempts/:attemptId/result
    fastify.put('/api/v1/internal/v1/n8n/attempts/:attemptId/result', async (request, reply) => {
        const { attemptId } = request.params;
        const body = ResultRequestSchema.parse(request.body);
        const attempt = await fastify.db.query.jobAttempts.findFirst({
            where: eq(jobAttempts.id, attemptId),
        });
        if (!attempt) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
        }
        const job = await fastify.db.query.jobs.findFirst({
            where: eq(jobs.id, attempt.jobId),
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
        }
        // Atomik olarak asset kaydet ve işi başarıyla tamamla
        await fastify.db.transaction(async (tx) => {
            // Önce üretilen görsel için asset kaydı oluştur
            const [newAsset] = await tx.insert(assets).values({
                key: body.key,
                bucket: config.S3_BUCKET_NAME,
                ownerId: job.ownerId,
                mimeType: body.mimeType,
                sizeBytes: body.sizeBytes,
                checksum: body.checksum,
                purpose: 'generated_asset',
                status: 'active',
            }).returning();
            await tx.update(jobAttempts)
                .set({
                status: 'succeeded',
                resultPayload: { assetId: newAsset.id, key: body.key },
                updatedAt: new Date()
            })
                .where(eq(jobAttempts.id, attemptId));
            await tx.update(jobs)
                .set({
                status: 'succeeded',
                imageId: newAsset.id,
                imageUrl: body.key, // veya presigned get url proxy yolu
                updatedAt: new Date()
            })
                .where(eq(jobs.id, job.id));
            await tx.insert(jobEvents).values({
                jobId: job.id,
                eventType: 'status_changed',
                payload: { status: 'succeeded', attemptId, assetId: newAsset.id },
            });
        });
        await notifyJobUpdate(job.id, 'succeeded', job.ownerId);
        return reply.send({ success: true });
    });
    // POST /api/v1/internal/v1/n8n/attempts/:attemptId/fail
    fastify.post('/api/v1/internal/v1/n8n/attempts/:attemptId/fail', async (request, reply) => {
        const { attemptId } = request.params;
        const { errorPayload, isRetryable } = FailRequestSchema.parse(request.body);
        const attempt = await fastify.db.query.jobAttempts.findFirst({
            where: eq(jobAttempts.id, attemptId),
        });
        if (!attempt) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş denemesi bulunamadı' });
        }
        const job = await fastify.db.query.jobs.findFirst({
            where: eq(jobs.id, attempt.jobId),
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İlgili iş bulunamadı' });
        }
        const finalStatus = isRetryable ? 'failed_retryable' : 'failed_terminal';
        await fastify.db.transaction(async (tx) => {
            await tx.update(jobAttempts)
                .set({
                status: finalStatus,
                errorPayload: errorPayload || null,
                updatedAt: new Date()
            })
                .where(eq(jobAttempts.id, attemptId));
            await tx.update(jobs)
                .set({ status: finalStatus, updatedAt: new Date() })
                .where(eq(jobs.id, job.id));
            await tx.insert(jobEvents).values({
                jobId: job.id,
                eventType: 'status_changed',
                payload: { status: finalStatus, attemptId, error: errorPayload },
            });
        });
        await notifyJobUpdate(job.id, finalStatus, job.ownerId);
        return reply.send({ success: true });
    });
    // POST /api/v1/internal/v1/n8n/executions/:executionId/fail
    fastify.post('/api/v1/internal/v1/n8n/executions/:executionId/fail', async (request, reply) => {
        const { executionId } = request.params;
        const { error } = request.body;
        fastify.log.error(`n8n workflow level failure in execution ${executionId}:`, error);
        // outbox_jobs veya benzeri yerlerde bu execution ile eşleşen bir job bulmaya çalışıp status update yapabiliriz
        // şimdilik sadece structured logging ile logluyoruz.
        return reply.send({ success: true });
    });
};
//# sourceMappingURL=internal.js.map