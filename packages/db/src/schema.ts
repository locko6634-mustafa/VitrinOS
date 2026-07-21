import { pgSchema, uuid, text, timestamp, integer, jsonb, boolean } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const appSchema = pgSchema('app');

export const users = appSchema.table('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('user'),
  status: text('status').notNull().default('active'),
  bannedUntil: timestamp('banned_until'),
  lastSignInAt: timestamp('last_sign_in_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const passwordCredentials = appSchema.table('password_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  passwordChangedAt: timestamp('password_changed_at').defaultNow().notNull(),
  securityVersion: integer('security_version').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const authSessions = appSchema.table('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  hashedSessionId: text('hashed_session_id').notNull().unique(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isRevoked: boolean('is_revoked').default(false).notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  ipDigest: text('ip_digest'),
  userAgentDigest: text('user_agent_digest'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mfaFactors = appSchema.table('mfa_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  factorType: text('factor_type').default('totp').notNull(),
  status: text('status').default('unverified').notNull(),
  secret: text('secret').notNull(), // AES-256-GCM ile şifrelenmiş TOTP sırrı
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const mfaRecoveryCodes = appSchema.table('mfa_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  codeHash: text('code_hash').notNull(),
  isUsed: boolean('is_used').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const oneTimeTokens = appSchema.table('one_time_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  purpose: text('purpose').notNull(), // 'forgot_password', 'activate_account', 'email_verification'
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const brands = appSchema.table('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  websiteUrl: text('website_url'),
  colorPalette: jsonb('color_palette').notNull().default({
    primary: '#d9962a',
    secondary: '#7a4f12',
    theme: 'koyu',
  }),
  toneRules: text('tone_rules'),
  bannedWords: text('banned_words').array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const brandPrompts = appSchema.table('brand_prompts', {
  brandId: uuid('brand_id').primaryKey().references(() => brands.id, { onDelete: 'cascade' }),
  basePrompt: text('base_prompt'),
  bannerPrompt: text('banner_prompt'),
  metaPostPrompt: text('meta_post_prompt'),
  storyPrompt: text('story_prompt'),
  revizePrompt: text('revize_prompt'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const assets = appSchema.table('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  bucket: text('bucket').notNull(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  checksum: text('checksum').notNull(),
  purpose: text('purpose').notNull(), // 'source_image', 'generated_asset', 'logo' vb.
  status: text('status').default('active').notNull(), // 'active', 'deleted'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobs = appSchema.table('jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'cascade' }).notNull(),
  briefText: text('brief_text').notNull(),
  format: text('format').notNull(), // 'Banner', 'Meta Post', 'Story'
  status: text('status').notNull().default('queued'), // 'queued', 'dispatching', 'processing', 'succeeded', 'failed_retryable', 'failed_terminal', 'cancelled'
  imageUrl: text('image_url'),
  imageId: uuid('image_id').references(() => assets.id, { onDelete: 'set null' }),
  revisionCount: integer('revision_count').default(0).notNull(),
  revisionNote: text('revision_note'),
  briefJson: jsonb('brief_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobAttempts = appSchema.table('job_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  status: text('status').notNull(), // 'queued', 'dispatching', 'processing', 'succeeded', 'failed_retryable', 'failed_terminal', 'cancelled'
  resultPayload: jsonb('result_payload'),
  errorPayload: jsonb('error_payload'),
  attemptNumber: integer('attempt_number').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jobEvents = appSchema.table('job_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  eventType: text('event_type').notNull(), // 'status_changed', 'attempt_failed' vb.
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const leads = appSchema.table('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  company: text('company').notNull(),
  email: text('email').notNull(),
  website: text('website'),
  need: text('need'),
  note: text('note'),
  status: text('status').default('new').notNull(), // 'new', 'reviewed', 'approved', 'rejected'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const leadAttempts = appSchema.table('lead_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  ipAddress: text('ip_address').notNull(),
  attemptHash: text('attempt_hash').notNull(),
  status: text('status').notNull(), // 'allowed', 'blocked'
  retryCount: integer('retry_count').default(0).notNull(),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const securityAuditLog = appSchema.table('security_audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'login', 'mfa_enabled', 'brand_updated' vb.
  targetType: text('target_type'), // 'user', 'brand', 'job' vb.
  targetId: text('target_id'),
  result: text('result').notNull(), // 'success', 'failure'
  correlationId: uuid('correlation_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storageCleanupQueue = appSchema.table('storage_cleanup_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
  lockedAt: timestamp('locked_at'),
  lockedBy: text('locked_by'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const outboxJobs = appSchema.table('outbox_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('queued'), // 'queued', 'processing', 'succeeded', 'failed'
  attemptCount: integer('attempt_count').default(0).notNull(),
  maxAttempts: integer('max_attempts').default(5).notNull(),
  nextAttemptAt: timestamp('next_attempt_at').defaultNow().notNull(),
  lockedAt: timestamp('locked_at'),
  lockedBy: text('locked_by'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
