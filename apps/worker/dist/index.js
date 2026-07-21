import crypto from 'node:crypto';
import { createDb, claimNextOutboxJob, eq, jobAttempts, jobEvents, jobs, outboxJobs, sql } from '@vitrinos/db';
import { generateHmacSignature } from '@vitrinos/security';
import { config } from './config.js';
const db = createDb(config.DATABASE_URL);
const workerId = `worker-${crypto.randomUUID()}`;
function retryAt(attemptCount) {
    const delaySeconds = Math.min(300, 10 * 2 ** Math.max(0, attemptCount - 1));
    return new Date(Date.now() + delaySeconds * 1000);
}
async function notify(jobId, status, ownerId) {
    const payload = JSON.stringify({ jobId, status, ownerId, timestamp: new Date().toISOString() });
    await db.execute(sql `SELECT pg_notify('job_updates', ${payload})`);
}
async function markDispatching(payload) {
    return db.transaction(async (tx) => {
        const job = await tx.query.jobs.findFirst({ where: eq(jobs.id, payload.jobId) });
        if (!job)
            throw new Error(`Outbox kaydı bulunmayan işe işaret ediyor: ${payload.jobId}`);
        if (job.status === 'cancelled')
            throw new Error(`İptal edilmiş iş dağıtılamaz: ${payload.jobId}`);
        await tx.update(jobAttempts)
            .set({ status: 'dispatching', updatedAt: new Date() })
            .where(eq(jobAttempts.id, payload.attemptId));
        await tx.update(jobs)
            .set({ status: 'dispatching', updatedAt: new Date() })
            .where(eq(jobs.id, payload.jobId));
        await tx.insert(jobEvents).values({
            jobId: payload.jobId,
            eventType: 'status_changed',
            payload: { status: 'dispatching', attemptId: payload.attemptId },
        });
        return { ownerId: job.ownerId, operation: job.revisionCount > 0 ? 'revision' : 'create_brief' };
    });
}
async function processDispatch(outbox) {
    const payload = outbox.payload;
    if (!payload?.jobId || !payload?.attemptId)
        throw new Error(`Geçersiz n8n dispatch payload: ${outbox.id}`);
    const context = await markDispatching(payload);
    await notify(payload.jobId, 'dispatching', context.ownerId);
    const body = {
        schemaVersion: '1.0',
        eventId: crypto.randomUUID(),
        attemptId: payload.attemptId,
        jobId: payload.jobId,
        operation: context.operation,
        correlationId: crypto.randomUUID(),
    };
    const serialized = JSON.stringify(body);
    const timestamp = Date.now().toString();
    const signature = generateHmacSignature(`${timestamp}.${serialized}`, config.N8N_WEBHOOK_SECRET);
    const response = await fetch(config.N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-vitrinos-timestamp': timestamp,
            'x-vitrinos-signature': signature,
        },
        body: serialized,
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
        throw new Error(`n8n webhook ${response.status} döndü`);
    await db.update(outboxJobs)
        .set({ status: 'succeeded', lockedAt: null, lockedBy: null, updatedAt: new Date() })
        .where(eq(outboxJobs.id, outbox.id));
}
async function handleFailure(outbox, error) {
    const message = error instanceof Error ? error.message : String(error);
    const terminal = outbox.attemptCount >= outbox.maxAttempts;
    const payload = outbox.payload;
    await db.transaction(async (tx) => {
        await tx.update(outboxJobs).set({
            status: 'failed',
            lastError: message.slice(0, 1000),
            nextAttemptAt: terminal ? new Date() : retryAt(outbox.attemptCount),
            lockedAt: null,
            lockedBy: null,
            updatedAt: new Date(),
        }).where(eq(outboxJobs.id, outbox.id));
        if (terminal && payload.jobId && payload.attemptId) {
            const job = await tx.query.jobs.findFirst({ where: eq(jobs.id, payload.jobId) });
            await tx.update(jobAttempts).set({ status: 'failed_retryable', errorPayload: { code: 'N8N_DISPATCH_FAILED' }, updatedAt: new Date() }).where(eq(jobAttempts.id, payload.attemptId));
            await tx.update(jobs).set({ status: 'failed_retryable', updatedAt: new Date() }).where(eq(jobs.id, payload.jobId));
            await tx.insert(jobEvents).values({ jobId: payload.jobId, eventType: 'attempt_failed', payload: { attemptId: payload.attemptId, code: 'N8N_DISPATCH_FAILED' } });
            if (job)
                await notify(payload.jobId, 'failed_retryable', job.ownerId);
        }
    });
}
async function workLoop() {
    try {
        const outbox = await db.transaction((tx) => claimNextOutboxJob(tx, workerId));
        if (!outbox)
            return;
        if (outbox.type !== 'n8n_dispatch') {
            await db.update(outboxJobs).set({ status: 'succeeded', lockedAt: null, lockedBy: null, updatedAt: new Date() }).where(eq(outboxJobs.id, outbox.id));
            return;
        }
        try {
            await processDispatch(outbox);
        }
        catch (error) {
            await handleFailure(outbox, error);
        }
    }
    catch (error) {
        console.error('Worker dispatch hatası:', error);
    }
    finally {
        setTimeout(workLoop, config.WORKER_POLL_INTERVAL_MS);
    }
}
console.log(`VitrinOS worker başladı: ${workerId}`);
void workLoop();
//# sourceMappingURL=index.js.map