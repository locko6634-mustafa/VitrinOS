"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimNextOutboxJob = claimNextOutboxJob;
exports.claimNextCleanupJob = claimNextCleanupJob;
const drizzle_orm_1 = require("drizzle-orm");
const schema_js_1 = require("./schema.js");
/**
 * Sıradaki outbox işini kilitler ve durumunu 'processing' yaparak döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
async function claimNextOutboxJob(db, workerId) {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    // Kilitlenebilir işler:
    // 1. Durumu 'queued' olanlar
    // 2. VEYA Durumu 'failed' olup deneme limiti aşılmamış ve çalışma zamanı gelmiş olanlar
    // VE (henüz kilitlenmemiş veya kilit süresi 5 dakikayı aşmış olanlar)
    const lockableJobs = await db
        .select()
        .from(schema_js_1.outboxJobs)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.outboxJobs.status, 'queued'), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.outboxJobs.status, 'failed'), (0, drizzle_orm_1.lt)(schema_js_1.outboxJobs.attemptCount, schema_js_1.outboxJobs.maxAttempts), (0, drizzle_orm_1.lte)(schema_js_1.outboxJobs.nextAttemptAt, now))), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_js_1.outboxJobs.lockedAt), (0, drizzle_orm_1.lt)(schema_js_1.outboxJobs.lockedAt, fiveMinutesAgo))))
        .orderBy(schema_js_1.outboxJobs.createdAt)
        .limit(1)
        .for('update', { skipLocked: true });
    if (lockableJobs.length === 0) {
        return null;
    }
    const job = lockableJobs[0];
    const [updatedJob] = await db
        .update(schema_js_1.outboxJobs)
        .set({
        status: 'processing',
        lockedAt: now,
        lockedBy: workerId,
        attemptCount: job.attemptCount + 1,
        updatedAt: now,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.outboxJobs.id, job.id))
        .returning();
    return updatedJob;
}
/**
 * Sıradaki dosya temizleme (storage cleanup) işini kilitler ve döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
async function claimNextCleanupJob(db, workerId) {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const lockableCleanupJobs = await db
        .select()
        .from(schema_js_1.storageCleanupQueue)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.lt)(schema_js_1.storageCleanupQueue.attemptCount, schema_js_1.storageCleanupQueue.maxAttempts), (0, drizzle_orm_1.lte)(schema_js_1.storageCleanupQueue.nextAttemptAt, now), (0, drizzle_orm_1.or)((0, drizzle_orm_1.isNull)(schema_js_1.storageCleanupQueue.lockedAt), (0, drizzle_orm_1.lt)(schema_js_1.storageCleanupQueue.lockedAt, fiveMinutesAgo))))
        .orderBy(schema_js_1.storageCleanupQueue.createdAt)
        .limit(1)
        .for('update', { skipLocked: true });
    if (lockableCleanupJobs.length === 0) {
        return null;
    }
    const job = lockableCleanupJobs[0];
    const [updatedJob] = await db
        .update(schema_js_1.storageCleanupQueue)
        .set({
        lockedAt: now,
        lockedBy: workerId,
        attemptCount: job.attemptCount + 1,
        updatedAt: now,
    })
        .where((0, drizzle_orm_1.eq)(schema_js_1.storageCleanupQueue.id, job.id))
        .returning();
    return updatedJob;
}
//# sourceMappingURL=repository.js.map