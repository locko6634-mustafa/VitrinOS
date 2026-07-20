export type DbTransaction = any;
/**
 * Sıradaki outbox işini kilitler ve durumunu 'processing' yaparak döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
export declare function claimNextOutboxJob(db: DbTransaction, workerId: string): Promise<any>;
/**
 * Sıradaki dosya temizleme (storage cleanup) işini kilitler ve döner.
 * Bu işlem mutlaka bir veritabanı transaction'ı içinde çağrılmalıdır.
 */
export declare function claimNextCleanupJob(db: DbTransaction, workerId: string): Promise<any>;
