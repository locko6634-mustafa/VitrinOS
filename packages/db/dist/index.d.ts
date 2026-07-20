import * as schema from './schema.js';
export declare const createDb: (connectionString: string) => import("drizzle-orm/node-postgres").NodePgDatabase<typeof schema>;
export { sql } from 'drizzle-orm';
export * from './schema.js';
