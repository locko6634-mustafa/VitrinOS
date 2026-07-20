import dotenv from 'dotenv';
import crypto from 'node:crypto';
import { createDb, jobs, jobAttempts, jobEvents, outboxJobs, eq, claimNextOutboxJob, sql } from '@vitrinos/db';
import { generateHmacSignature } from '@vitrinos/security';
import { config } from './config.js';
dotenv.config();
console.log('VitrinOS Worker is starting...');
console.log(`Node Environment: ${config.NODE_ENV}`);
console.log(`Database URL: ${config.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')}`);
console.log(`n8n Webhook URL: ${config.N8N_WEBHOOK_URL}`);
const db = createDb(config.DATABASE_URL);
const workerId = `worker-${crypto.randomUUID()}`;
async function processOutboxJob(job) {
    console.log(`[Worker] Processing outbox job ${job.id} of type ${job.type} (Attempt ${job.attemptCount}/${job.maxAttempts})`);
    if (job.type !== 'n8n_dispatch') {
        // Bilinmeyen iş tiplerini doğrudan başarıyla sonlandırıyoruz (gelecekte e-posta vb. eklenebilir)
        await db.update(outboxJobs)
            .set({ status: 'succeeded', updatedAt: new Date() })
            .where(eq(outboxJobs.id, job.id));
        console.log(`[Worker] Job ${job.id} has unknown type ${job.type}, marked as succeeded.`);
        return;
    }
    const payload = job.payload;
    // jobs tablosundan işin revizyon durumunu kontrol et
    const jobRecord = await db.query.jobs.findFirst({
        where: eq(jobs.id, payload.jobId),
    });
    if (!jobRecord) {
        throw new Error(`Outbox job payload references non-existing job: ${payload.jobId}`);
    }
    const isRevision = jobRecord.revisionCount > 0;
    const operation = isRevision ? 'revision' : 'create_brief';
    // n8n için daraltılmış ve güvenli gövdeyi hazırla
    const body = {
        schemaVersion: '1.0',
        eventId: crypto.randomUUID(),
        attemptId: payload.attemptId,
        jobId: payload.jobId,
        operation,
        correlationId: crypto.randomUUID()
    };
    const timestamp = Date.now().toString();
    const bodyString = JSON.stringify(body);
    const signatureData = `${timestamp}.${bodyString}`;
    const signature = generateHmacSignature(signatureData, config.N8N_WEBHOOK_SECRET);
    console.log(`[Worker] Dispatching job ${payload.jobId} to n8n (Operation: ${operation})`);
    // n8n Webhook çağrısı yap
    const response = await fetch(config.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-vitrinos-signature': signature,
            'x-vitrinos-timestamp': timestamp,
        },
        body: bodyString,
    });
    if (!response.ok) {
        const errorText = await response.text().catch(() => 'No body');
        throw new Error(`n8n webhook responded with status ${response.status}: ${errorText}`);
    }
    console.log(`[Worker] Successfully dispatched job ${payload.jobId} to n8n.`);
    // Atomik olarak outbox'ı ve iş durumlarını güncelle
    await db.transaction(async (tx) => {
        // 1. Outbox durumunu başarılı yap
        await tx.update(outboxJobs)
            .set({ status: 'succeeded', updatedAt: new Date() })
            .where(eq(outboxJobs.id, job.id));
        // 2. Job ve JobAttempt durumunu 'dispatching' yap
        await tx.update(jobAttempts)
            .set({ status: 'dispatching', updatedAt: new Date() })
            .where(eq(jobAttempts.id, payload.attemptId));
        await tx.update(jobs)
            .set({ status: 'dispatching', updatedAt: new Date() })
            .where(eq(jobs.id, payload.jobId));
        // 3. Olay kaydı ekle
        await tx.insert(jobEvents).values({
            jobId: payload.jobId,
            eventType: 'status_changed',
            payload: { status: 'dispatching', attemptId: payload.attemptId },
        });
    });
    // SSE (Server-Sent Events) veya PostgreSQL LISTEN/NOTIFY yayını tetikleme
    const notifyPayload = JSON.stringify({ jobId: payload.jobId, status: 'dispatching', ownerId: jobRecord.ownerId, timestamp: new Date().toISOString() });
    await db.execute(sql `SELECT pg_notify('job_updates', ${notifyPayload})`);
    console.log(`[Worker] Job ${payload.jobId} status updated to dispatching and notified.`);
}
async function handleJobFailure(job, error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Error processing job ${job.id}:`, errorMsg);
    const nextAttemptCount = job.attemptCount; // claim sırasında zaten artırılmıştı
    const isTerminal = nextAttemptCount >= job.maxAttempts;
    if (isTerminal) {
        console.log(`[Worker] Job ${job.id} reached maximum attempts (${job.maxAttempts}). Marking as terminal failure.`);
        const payload = job.payload;
        await db.transaction(async (tx) => {
            // Outbox durumunu failed yap
            await tx.update(outboxJobs)
                .set({
                status: 'failed',
                lastError: errorMsg,
                updatedAt: new Date()
            })
                .where(eq(outboxJobs.id, job.id));
            // İş durumunu failed_retryable yap ki kullanıcı panelden retry edebilsin
            await tx.update(jobAttempts)
                .set({
                status: 'failed_retryable',
                errorPayload: { message: errorMsg },
                updatedAt: new Date()
            })
                .where(eq(jobAttempts.id, payload.attemptId));
            const [updatedJob] = await tx.update(jobs)
                .set({
                status: 'failed_retryable',
                revisionNote: `Dağıtım Hatası: n8n sunucusuna erişilemedi. (${errorMsg})`,
                updatedAt: new Date()
            })
                .where(eq(jobs.id, payload.jobId))
                .returning();
            await tx.insert(jobEvents).values({
                jobId: payload.jobId,
                eventType: 'attempt_failed',
                payload: { attemptId: payload.attemptId, error: errorMsg },
            });
            // SSE yayını
            const notifyPayload = JSON.stringify({ jobId: payload.jobId, status: 'failed_retryable', ownerId: updatedJob.ownerId, timestamp: new Date().toISOString() });
            await tx.execute(sql `SELECT pg_notify('job_updates', ${notifyPayload})`);
        });
    }
    else {
        // Exponential Backoff: 10sn * 2^attempt
        const delaySeconds = 10 * Math.pow(2, nextAttemptCount - 1);
        const nextAttemptAt = new Date(Date.now() + delaySeconds * 1000);
        console.log(`[Worker] Scheduling retry for job ${job.id} at ${nextAttemptAt.toISOString()} (in ${delaySeconds}s)`);
        await db.update(outboxJobs)
            .set({
            status: 'failed',
            lastError: errorMsg,
            nextAttemptAt,
            updatedAt: new Date()
        })
            .where(eq(outboxJobs.id, job.id));
    }
}
async function workLoop() {
    try {
        // Veritabanı transaction'ı içinde sıradaki işi kilitliyoruz
        const job = await db.transaction(async (tx) => {
            return await claimNextOutboxJob(tx, workerId);
        });
        if (job) {
            try {
                await processOutboxJob(job);
            }
            catch (error) {
                await handleJobFailure(job, error);
            }
            // İş bulunduğunda beklemeden hemen sonraki işi kontrol et
            setImmediate(workLoop);
        }
        else {
            // İş yoksa 5 saniye bekle
            setTimeout(workLoop, 5000);
        }
    }
    catch (error) {
        console.error('[Worker] Fatal error in work loop:', error);
        // Veritabanı bağlantı hataları vb. durumunda da 5 saniye bekleyip devam et
        setTimeout(workLoop, 5000);
    }
}
workLoop();
//# sourceMappingURL=index.js.map