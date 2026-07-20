import { eq, and, or, lte, isNull, lt } from 'drizzle-orm';
import { outboxJobs, storageCleanupQueue } from './schema.js';

export type DbTransaction = any;

/**
 * Sıradaki outbox işini kilitler ve durumunu 'processing' yaparak döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
export async function claimNextOutboxJob(db: DbTransaction, workerId: string) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // Kilitlenebilir işler:
  // 1. Durumu 'queued' olanlar
  // 2. VEYA Durumu 'failed' olup deneme limiti aşılmamış ve çalışma zamanı gelmiş olanlar
  // VE (henüz kilitlenmemiş veya kilit süresi 5 dakikayı aşmış olanlar)
  const lockableJobs = await db
    .select()
    .from(outboxJobs)
    .where(
      and(
        or(
          eq(outboxJobs.status, 'queued'),
          and(
            eq(outboxJobs.status, 'failed'),
            lt(outboxJobs.attemptCount, outboxJobs.maxAttempts),
            lte(outboxJobs.nextAttemptAt, now)
          )
        ),
        or(
          isNull(outboxJobs.lockedAt),
          lt(outboxJobs.lockedAt, fiveMinutesAgo)
        )
      )
    )
    .orderBy(outboxJobs.createdAt)
    .limit(1)
    .for('update', { skipLocked: true });

  if (lockableJobs.length === 0) {
    return null;
  }

  const job = lockableJobs[0];

  const [updatedJob] = await db
    .update(outboxJobs)
    .set({
      status: 'processing',
      lockedAt: now,
      lockedBy: workerId,
      attemptCount: job.attemptCount + 1,
      updatedAt: now,
    })
    .where(eq(outboxJobs.id, job.id))
    .returning();

  return updatedJob;
}

/**
 * Sıradaki dosya temizleme (storage cleanup) işini kilitler ve döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
export async function claimNextCleanupJob(db: DbTransaction, workerId: string) {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const lockableCleanupJobs = await db
    .select()
    .from(storageCleanupQueue)
    .where(
      and(
        lt(storageCleanupQueue.attemptCount, storageCleanupQueue.maxAttempts),
        lte(storageCleanupQueue.nextAttemptAt, now),
        or(
          isNull(storageCleanupQueue.lockedAt),
          lt(storageCleanupQueue.lockedAt, fiveMinutesAgo)
        )
      )
    )
    .orderBy(storageCleanupQueue.createdAt)
    .limit(1)
    .for('update', { skipLocked: true });

  if (lockableCleanupJobs.length === 0) {
    return null;
  }

  const job = lockableCleanupJobs[0];

  const [updatedJob] = await db
    .update(storageCleanupQueue)
    .set({
      lockedAt: now,
      lockedBy: workerId,
      attemptCount: job.attemptCount + 1,
      updatedAt: now,
    })
    .where(eq(storageCleanupQueue.id, job.id))
    .returning();

  return updatedJob;
}
