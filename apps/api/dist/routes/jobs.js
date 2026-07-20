import { z } from 'zod';
import crypto from 'node:crypto';
import pg from 'pg';
import { jobs, jobAttempts, jobEvents, outboxJobs, brands, assets, eq, and, sql } from '@vitrinos/db';
import { config } from '../config.js';
const CreateJobSchema = z.object({
    brandId: z.string().uuid('Geçersiz brandId'),
    briefText: z.string().min(5, 'Brief en az 5 karakter olmalıdır'),
    format: z.enum(['Banner', 'Meta Post', 'Story']),
    imageId: z.string().uuid('Geçersiz imageId').optional().nullable(),
});
// SSE için global PG listener bağlantısı
let pgListener = null;
const sseClients = new Set();
async function startPgListener(fastify) {
    if (pgListener)
        return;
    try {
        pgListener = new pg.Client({ connectionString: config.DATABASE_URL });
        await pgListener.connect();
        await pgListener.query('LISTEN job_updates');
        pgListener.on('notification', (msg) => {
            if (msg.channel === 'job_updates' && msg.payload) {
                try {
                    const payload = JSON.parse(msg.payload);
                    for (const sendToClient of sseClients) {
                        sendToClient(payload);
                    }
                }
                catch (e) {
                    fastify.log.error('Notify payload parse error:', e);
                }
            }
        });
        fastify.log.info('PostgreSQL LISTEN/NOTIFY listener started for job_updates');
    }
    catch (err) {
        fastify.log.error('Failed to start PG listener:', err);
        pgListener = null;
    }
}
export const jobsRoutes = async (fastify) => {
    // PG Listener başlat
    await startPgListener(fastify);
    // Kimlik doğrulama kontrolü (SSE kanalı dahil tüm uçlar için)
    fastify.addHook('preHandler', async (request, reply) => {
        if (!request.user) {
            return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Yetkisiz erişim' });
        }
    });
    // Helper: Durum güncelleme ve NOTIFY yayını
    const notifyJobUpdate = async (jobId, status, ownerId) => {
        const payload = JSON.stringify({ jobId, status, ownerId, timestamp: new Date().toISOString() });
        await fastify.db.execute(sql `SELECT pg_notify('job_updates', ${payload})`);
    };
    // POST /api/v1/jobs
    fastify.post('/api/v1/jobs', async (request, reply) => {
        const idempotencyKey = request.headers['idempotency-key'];
        if (!idempotencyKey) {
            return reply.code(400).send({ code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key başlığı zorunludur' });
        }
        const body = CreateJobSchema.parse(request.body);
        const requestHash = crypto.createHash('md5').update(JSON.stringify(body)).digest('hex');
        // Idempotency kontrolü (briefJson içinde idempotencyKey arıyoruz)
        const existingJob = await fastify.db.query.jobs.findFirst({
            where: and(eq(jobs.ownerId, request.user.id), sql `brief_json->>'idempotencyKey' = ${idempotencyKey}`)
        });
        if (existingJob) {
            const briefMeta = existingJob.briefJson;
            if (briefMeta?.requestHash !== requestHash) {
                return reply.code(409).send({
                    code: 'IDEMPOTENCY_CONFLICT',
                    message: 'Aynı idempotency key ile farklı bir istek gövdesi gönderildi'
                });
            }
            return reply.send({ data: existingJob });
        }
        // Marka varlığı ve yetki kontrolü
        const brand = await fastify.db.query.brands.findFirst({
            where: request.user.role === 'admin'
                ? eq(brands.id, body.brandId)
                : and(eq(brands.id, body.brandId), eq(brands.userId, request.user.id))
        });
        if (!brand) {
            return reply.code(404).send({ code: 'BRAND_NOT_FOUND', message: 'Marka bulunamadı veya yetkiniz yok' });
        }
        // Görsel varlığı kontrolü (varsa)
        if (body.imageId) {
            const asset = await fastify.db.query.assets.findFirst({
                where: and(eq(assets.id, body.imageId), eq(assets.status, 'active'))
            });
            if (!asset) {
                return reply.code(400).send({ code: 'INVALID_IMAGE', message: 'Geçersiz veya yüklenmemiş görsel' });
            }
        }
        // Atomik olarak job, attempt ve outbox dispatch oluştur
        const newJob = await fastify.db.transaction(async (tx) => {
            const [insertedJob] = await tx.insert(jobs).values({
                ownerId: request.user.id,
                brandId: body.brandId,
                briefText: body.briefText,
                format: body.format,
                imageId: body.imageId || null,
                status: 'queued',
                briefJson: {
                    idempotencyKey,
                    requestHash,
                }
            }).returning();
            const [attempt] = await tx.insert(jobAttempts).values({
                jobId: insertedJob.id,
                status: 'queued',
                attemptNumber: 1,
            }).returning();
            await tx.insert(jobEvents).values({
                jobId: insertedJob.id,
                eventType: 'status_changed',
                payload: { status: 'queued', attemptId: attempt.id },
            });
            // Outbox task'i ekle
            await tx.insert(outboxJobs).values({
                type: 'n8n_dispatch',
                payload: {
                    jobId: insertedJob.id,
                    attemptId: attempt.id,
                    brandId: body.brandId,
                    format: body.format,
                    briefText: body.briefText,
                },
                status: 'queued',
            });
            return insertedJob;
        });
        // SSE yayını tetikle
        await notifyJobUpdate(newJob.id, 'queued', request.user.id);
        return reply.code(201).send({ data: newJob });
    });
    // GET /api/v1/jobs
    fastify.get('/api/v1/jobs', async (request, reply) => {
        const userJobs = await fastify.db.query.jobs.findMany({
            where: request.user.role === 'admin' ? undefined : eq(jobs.ownerId, request.user.id),
            orderBy: (jobs, { desc }) => [desc(jobs.createdAt)],
        });
        return reply.send({ data: userJobs });
    });
    // GET /api/v1/jobs/:jobId
    fastify.get('/api/v1/jobs/:jobId', async (request, reply) => {
        const { jobId } = request.params;
        const job = await fastify.db.query.jobs.findFirst({
            where: request.user.role === 'admin'
                ? eq(jobs.id, jobId)
                : and(eq(jobs.id, jobId), eq(jobs.ownerId, request.user.id))
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş bulunamadı' });
        }
        return reply.send({ data: job });
    });
    // POST /api/v1/jobs/:jobId/retry
    fastify.post('/api/v1/jobs/:jobId/retry', async (request, reply) => {
        const { jobId } = request.params;
        const job = await fastify.db.query.jobs.findFirst({
            where: request.user.role === 'admin'
                ? eq(jobs.id, jobId)
                : and(eq(jobs.id, jobId), eq(jobs.ownerId, request.user.id))
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş bulunamadı' });
        }
        const retryableStatuses = ['failed_retryable', 'failed_terminal'];
        if (!retryableStatuses.includes(job.status)) {
            return reply.code(400).send({
                code: 'INVALID_STATUS',
                message: `Yalnızca başarısız işler tekrar denenebilir. Mevcut durum: ${job.status}`
            });
        }
        // Son deneme numarasını al
        const currentAttempts = await fastify.db.query.jobAttempts.findMany({
            where: eq(jobAttempts.jobId, jobId),
        });
        const nextAttemptNumber = currentAttempts.length + 1;
        const updatedJob = await fastify.db.transaction(async (tx) => {
            const [attempt] = await tx.insert(jobAttempts).values({
                jobId,
                status: 'queued',
                attemptNumber: nextAttemptNumber,
            }).returning();
            const [updated] = await tx.update(jobs)
                .set({
                status: 'queued',
                updatedAt: new Date(),
            })
                .where(eq(jobs.id, jobId))
                .returning();
            await tx.insert(jobEvents).values({
                jobId,
                eventType: 'status_changed',
                payload: { status: 'queued', attemptId: attempt.id },
            });
            // Outbox dispatch ekle
            await tx.insert(outboxJobs).values({
                type: 'n8n_dispatch',
                payload: {
                    jobId,
                    attemptId: attempt.id,
                    brandId: job.brandId,
                    format: job.format,
                    briefText: job.briefText,
                },
                status: 'queued',
            });
            return updated;
        });
        await notifyJobUpdate(jobId, 'queued', request.user.id);
        return reply.send({ data: updatedJob });
    });
    // POST /api/v1/jobs/:jobId/cancel
    fastify.post('/api/v1/jobs/:jobId/cancel', async (request, reply) => {
        const { jobId } = request.params;
        const job = await fastify.db.query.jobs.findFirst({
            where: request.user.role === 'admin'
                ? eq(jobs.id, jobId)
                : and(eq(jobs.id, jobId), eq(jobs.ownerId, request.user.id))
        });
        if (!job) {
            return reply.code(404).send({ code: 'NOT_FOUND', message: 'İş bulunamadı' });
        }
        const cancelableStatuses = ['queued', 'dispatching', 'processing'];
        if (!cancelableStatuses.includes(job.status)) {
            return reply.code(400).send({
                code: 'INVALID_STATUS',
                message: `Bu durumdaki işler iptal edilemez. Mevcut durum: ${job.status}`
            });
        }
        const updatedJob = await fastify.db.transaction(async (tx) => {
            const [updated] = await tx.update(jobs)
                .set({
                status: 'cancelled',
                updatedAt: new Date(),
            })
                .where(eq(jobs.id, jobId))
                .returning();
            // En son attempt'i de cancelled yapalım
            const lastAttempt = await tx.query.jobAttempts.findFirst({
                where: eq(jobAttempts.jobId, jobId),
                orderBy: (attempts, { desc }) => [desc(attempts.createdAt)],
            });
            if (lastAttempt && ['queued', 'dispatching', 'processing'].includes(lastAttempt.status)) {
                await tx.update(jobAttempts)
                    .set({ status: 'cancelled', updatedAt: new Date() })
                    .where(eq(jobAttempts.id, lastAttempt.id));
            }
            await tx.insert(jobEvents).values({
                jobId,
                eventType: 'status_changed',
                payload: { status: 'cancelled' },
            });
            return updated;
        });
        await notifyJobUpdate(jobId, 'cancelled', request.user.id);
        return reply.send({ data: updatedJob });
    });
    // GET /api/v1/events/jobs (Server-Sent Events)
    fastify.get('/api/v1/events/jobs', async (request, reply) => {
        const headers = {
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
        };
        reply.raw.writeHead(200, headers);
        reply.raw.write('\n'); // keep-alive için ilk boşluk
        const userId = request.user.id;
        const userRole = request.user.role;
        // Bağlantı kopmalarını yönetmek için Last-Event-ID desteği
        const lastEventId = request.headers['last-event-id'] || request.query.lastEventId;
        if (lastEventId) {
            try {
                // Last-Event-ID'ye sahip event'ten sonraki kendi event'lerini getir
                const targetEvent = await fastify.db.query.jobEvents.findFirst({
                    where: eq(jobEvents.id, lastEventId)
                });
                if (targetEvent) {
                    const missedEvents = await fastify.db.execute(sql `
            SELECT je.*, j.owner_id 
            FROM app.job_events je
            JOIN app.jobs j ON je.job_id = j.id
            WHERE je.created_at > ${targetEvent.createdAt}
            AND (${userRole === 'admin'} OR j.owner_id = ${userId})
            ORDER BY je.created_at ASC
          `);
                    for (const event of (missedEvents.rows || [])) {
                        reply.raw.write(`id: ${event.id}\n`);
                        reply.raw.write('event: message\n');
                        reply.raw.write(`data: ${JSON.stringify({ jobId: event.job_id, status: event.payload?.status || 'unknown', ownerId: event.owner_id })}\n\n`);
                    }
                }
            }
            catch (err) {
                fastify.log.error(err, 'SSE Last-Event-ID missed events fetch error:');
            }
        }
        // İstemciye veri gönderme fonksiyonu
        const sendEvent = (payload) => {
            // Eğer admin değilse ve payload sahibi bu kullanıcı değilse es geç
            if (userRole !== 'admin' && payload.ownerId !== userId) {
                return;
            }
            const eventId = crypto.randomUUID(); // Her SSE yayını için tekil event ID
            reply.raw.write(`id: ${eventId}\n`);
            reply.raw.write('event: message\n');
            reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        sseClients.add(sendEvent);
        request.raw.on('close', () => {
            sseClients.delete(sendEvent);
        });
    });
};
//# sourceMappingURL=jobs.js.map