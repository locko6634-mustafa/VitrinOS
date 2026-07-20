"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outboxJobs = exports.storageCleanupQueue = exports.securityAuditLog = exports.leadAttempts = exports.leads = exports.jobEvents = exports.jobAttempts = exports.jobs = exports.assets = exports.brandPrompts = exports.brands = exports.oneTimeTokens = exports.mfaRecoveryCodes = exports.mfaFactors = exports.authSessions = exports.passwordCredentials = exports.users = exports.appSchema = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
exports.appSchema = (0, pg_core_1.pgSchema)('app');
exports.users = exports.appSchema.table('users', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.text)('email').notNull().unique(),
    role: (0, pg_core_1.text)('role').notNull().default('user'),
    status: (0, pg_core_1.text)('status').notNull().default('active'),
    bannedUntil: (0, pg_core_1.timestamp)('banned_until'),
    lastSignInAt: (0, pg_core_1.timestamp)('last_sign_in_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.passwordCredentials = exports.appSchema.table('password_credentials', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull().unique(),
    passwordHash: (0, pg_core_1.text)('password_hash').notNull(),
    passwordChangedAt: (0, pg_core_1.timestamp)('password_changed_at').defaultNow().notNull(),
    securityVersion: (0, pg_core_1.integer)('security_version').default(1).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.authSessions = exports.appSchema.table('auth_sessions', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    hashedSessionId: (0, pg_core_1.text)('hashed_session_id').notNull().unique(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    isRevoked: (0, pg_core_1.boolean)('is_revoked').default(false).notNull(),
    lastUsedAt: (0, pg_core_1.timestamp)('last_used_at').defaultNow().notNull(),
    ipDigest: (0, pg_core_1.text)('ip_digest'),
    userAgentDigest: (0, pg_core_1.text)('user_agent_digest'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.mfaFactors = exports.appSchema.table('mfa_factors', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    factorType: (0, pg_core_1.text)('factor_type').default('totp').notNull(),
    status: (0, pg_core_1.text)('status').default('unverified').notNull(),
    secret: (0, pg_core_1.text)('secret').notNull(), // AES-256-GCM ile şifrelenmiş TOTP sırrı
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.mfaRecoveryCodes = exports.appSchema.table('mfa_recovery_codes', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    codeHash: (0, pg_core_1.text)('code_hash').notNull(),
    isUsed: (0, pg_core_1.boolean)('is_used').default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.oneTimeTokens = exports.appSchema.table('one_time_tokens', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    tokenHash: (0, pg_core_1.text)('token_hash').notNull().unique(),
    purpose: (0, pg_core_1.text)('purpose').notNull(), // 'forgot_password', 'activate_account', 'email_verification'
    expiresAt: (0, pg_core_1.timestamp)('expires_at').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.brands = exports.appSchema.table('brands', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'set null' }),
    name: (0, pg_core_1.text)('name').notNull(),
    logoUrl: (0, pg_core_1.text)('logo_url'),
    websiteUrl: (0, pg_core_1.text)('website_url'),
    colorPalette: (0, pg_core_1.jsonb)('color_palette').notNull().default({
        primary: '#d9962a',
        secondary: '#7a4f12',
        theme: 'koyu',
    }),
    toneRules: (0, pg_core_1.text)('tone_rules'),
    bannedWords: (0, pg_core_1.text)('banned_words').array().notNull().default([]),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.brandPrompts = exports.appSchema.table('brand_prompts', {
    brandId: (0, pg_core_1.uuid)('brand_id').primaryKey().references(() => exports.brands.id, { onDelete: 'cascade' }),
    basePrompt: (0, pg_core_1.text)('base_prompt'),
    bannerPrompt: (0, pg_core_1.text)('banner_prompt'),
    metaPostPrompt: (0, pg_core_1.text)('meta_post_prompt'),
    storyPrompt: (0, pg_core_1.text)('story_prompt'),
    revizePrompt: (0, pg_core_1.text)('revize_prompt'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.assets = exports.appSchema.table('assets', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    key: (0, pg_core_1.text)('key').notNull().unique(),
    bucket: (0, pg_core_1.text)('bucket').notNull(),
    ownerId: (0, pg_core_1.uuid)('owner_id').references(() => exports.users.id, { onDelete: 'set null' }),
    mimeType: (0, pg_core_1.text)('mime_type').notNull(),
    sizeBytes: (0, pg_core_1.integer)('size_bytes').notNull(),
    checksum: (0, pg_core_1.text)('checksum').notNull(),
    purpose: (0, pg_core_1.text)('purpose').notNull(), // 'source_image', 'generated_asset', 'logo' vb.
    status: (0, pg_core_1.text)('status').default('active').notNull(), // 'active', 'deleted'
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.jobs = exports.appSchema.table('jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    ownerId: (0, pg_core_1.uuid)('owner_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    brandId: (0, pg_core_1.uuid)('brand_id').references(() => exports.brands.id, { onDelete: 'cascade' }).notNull(),
    briefText: (0, pg_core_1.text)('brief_text').notNull(),
    format: (0, pg_core_1.text)('format').notNull(), // 'Banner', 'Meta Post', 'Story'
    status: (0, pg_core_1.text)('status').notNull().default('queued'), // 'queued', 'dispatching', 'processing', 'succeeded', 'failed_retryable', 'failed_terminal', 'cancelled'
    imageUrl: (0, pg_core_1.text)('image_url'),
    imageId: (0, pg_core_1.uuid)('image_id').references(() => exports.assets.id, { onDelete: 'set null' }),
    revisionCount: (0, pg_core_1.integer)('revision_count').default(0).notNull(),
    revisionNote: (0, pg_core_1.text)('revision_note'),
    briefJson: (0, pg_core_1.jsonb)('brief_json'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.jobAttempts = exports.appSchema.table('job_attempts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)('job_id').references(() => exports.jobs.id, { onDelete: 'cascade' }).notNull(),
    status: (0, pg_core_1.text)('status').notNull(), // 'queued', 'dispatching', 'processing', 'succeeded', 'failed_retryable', 'failed_terminal', 'cancelled'
    resultPayload: (0, pg_core_1.jsonb)('result_payload'),
    errorPayload: (0, pg_core_1.jsonb)('error_payload'),
    attemptNumber: (0, pg_core_1.integer)('attempt_number').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.jobEvents = exports.appSchema.table('job_events', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    jobId: (0, pg_core_1.uuid)('job_id').references(() => exports.jobs.id, { onDelete: 'cascade' }).notNull(),
    eventType: (0, pg_core_1.text)('event_type').notNull(), // 'status_changed', 'attempt_failed' vb.
    payload: (0, pg_core_1.jsonb)('payload'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.leads = exports.appSchema.table('leads', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    name: (0, pg_core_1.text)('name').notNull(),
    company: (0, pg_core_1.text)('company').notNull(),
    email: (0, pg_core_1.text)('email').notNull(),
    website: (0, pg_core_1.text)('website'),
    need: (0, pg_core_1.text)('need'),
    note: (0, pg_core_1.text)('note'),
    status: (0, pg_core_1.text)('status').default('new').notNull(), // 'new', 'reviewed', 'approved', 'rejected'
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.leadAttempts = exports.appSchema.table('lead_attempts', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    email: (0, pg_core_1.text)('email').notNull(),
    ipAddress: (0, pg_core_1.text)('ip_address').notNull(),
    attemptHash: (0, pg_core_1.text)('attempt_hash').notNull(),
    status: (0, pg_core_1.text)('status').notNull(), // 'allowed', 'blocked'
    retryCount: (0, pg_core_1.integer)('retry_count').default(0).notNull(),
    lastError: (0, pg_core_1.text)('last_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.securityAuditLog = exports.appSchema.table('security_audit_log', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    actorId: (0, pg_core_1.uuid)('actor_id').references(() => exports.users.id, { onDelete: 'set null' }),
    action: (0, pg_core_1.text)('action').notNull(), // 'login', 'mfa_enabled', 'brand_updated' vb.
    targetType: (0, pg_core_1.text)('target_type'), // 'user', 'brand', 'job' vb.
    targetId: (0, pg_core_1.text)('target_id'),
    result: (0, pg_core_1.text)('result').notNull(), // 'success', 'failure'
    correlationId: (0, pg_core_1.uuid)('correlation_id'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.storageCleanupQueue = exports.appSchema.table('storage_cleanup_queue', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    assetId: (0, pg_core_1.uuid)('asset_id').references(() => exports.assets.id, { onDelete: 'cascade' }).notNull(),
    attemptCount: (0, pg_core_1.integer)('attempt_count').default(0).notNull(),
    maxAttempts: (0, pg_core_1.integer)('max_attempts').default(5).notNull(),
    nextAttemptAt: (0, pg_core_1.timestamp)('next_attempt_at').defaultNow().notNull(),
    lockedAt: (0, pg_core_1.timestamp)('locked_at'),
    lockedBy: (0, pg_core_1.text)('locked_by'),
    lastError: (0, pg_core_1.text)('last_error'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.outboxJobs = exports.appSchema.table('outbox_jobs', {
    id: (0, pg_core_1.uuid)('id').primaryKey().defaultRandom(),
    type: (0, pg_core_1.text)('type').notNull(),
    payload: (0, pg_core_1.jsonb)('payload').notNull(),
    status: (0, pg_core_1.text)('status').notNull().default('queued'), // 'queued', 'processing', 'succeeded', 'failed'
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