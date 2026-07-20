"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboxJobs = exports.jobs = exports.users = exports.appSchema = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.appSchema = (0, pg_core_1.pgSchema)('app');
exports.users = exports.appSchema.table('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.text)('email').notNull().unique(),
    role: (0, pg_core_1.text)('role').notNull().default('user'),
    status: (0, pg_core_1.text)('status').notNull().default('active'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.jobs = exports.appSchema.table('jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    ownerId: (0, pg_core_1.uuid)('owner_id').references(() => exports.users.id).notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('queued'),
    payload: (0, pg_core_1.jsonb)('payload'),
    result: (0, pg_core_1.jsonb)('result'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.outboxJobs = exports.appSchema.table('outbox_jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    type: (0, pg_core_1.text)('type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('queued'),
    attemptCount: (0, pg_core_1.integer)('attempt_count').default(0).notNull(),
    maxAttempts: (0, pg_core_1.integer)('max_attempts').default(5).notNull(),
    nextAttemptAt: (0, pg_core_1.timestamp)('next_attempt_at').defaultNow().notNull(),
    lockedAt: (0, pg_core_1.timestamp)('locked_at'),
    lockedBy: (0, pg_core_1.text)('locked_by'),
    lastError: (0, pg_core_1.text)('last_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
//# sourceMappingURL=schema.js.map