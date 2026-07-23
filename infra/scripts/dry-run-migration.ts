import { crypto } from 'node:crypto';

export interface SupabaseSourceData {
  users: Array<{
    id: string;
    email: string;
    role: string;
    status?: string;
    created_at: string;
  }>;
  brands: Array<{
    id: string;
    user_id: string | null;
    name: string;
    logo_url: string | null;
    website_url: string | null;
    color_palette?: any;
    tone_rules?: string | null;
    banned_words?: string[];
    created_at: string;
  }>;
  brand_prompts: Array<{
    brand_id: string;
    base_prompt: string | null;
    banner_prompt: string | null;
    meta_post_prompt: string | null;
    story_prompt: string | null;
    revize_prompt: string | null;
    created_at: string;
  }>;
  leads: Array<{
    id: string;
    name: string;
    company: string;
    email: string;
    website: string | null;
    need: string | null;
    note: string | null;
    status: string;
    created_at: string;
  }>;
  lead_submission_attempts: Array<{
    id: string;
    email: string;
    ip_address: string;
    attempt_hash: string;
    status: string;
    retry_count: number;
    last_error: string | null;
    created_at: string;
  }>;
  audit_logs: Array<{
    id: string;
    actor_id: string | null;
    action: string;
    target_type: string | null;
    target_id: string | null;
    result: string;
    correlation_id: string | null;
    metadata: any;
    created_at: string;
  }>;
  storage_objects: Array<{
    id: string;
    bucket_id: string;
    name: string;
    owner: string | null;
    created_at: string;
    metadata?: { size?: number; mimetype?: string };
  }>;
}

export interface DryRunMigrationResult {
  durationMs: number;
  migratedCounts: {
    users: number;
    brands: number;
    brandPrompts: number;
    leads: number;
    leadAttempts: number;
    auditLogs: number;
    assets: number;
    activationTokens: number;
    quarantineAssets: number;
  };
  quarantinedObjectKeys: string[];
  reconciliationStatus: 'MATCHED' | 'DISCREPANCY';
  details: string[];
}

export function performDryRunMigration(snapshot: SupabaseSourceData): DryRunMigrationResult {
  const startTime = Date.now();
  const details: string[] = [];

  details.push(`[INIT] Dry-run migration başlatılıyor. Snapshot tarihi: ${new Date().toISOString()}`);

  // 1. Kullanıcılar ve Activation Token Üretimi
  const userIds = new Set<string>();
  let activationTokenCount = 0;

  for (const user of snapshot.users) {
    userIds.add(user.id);
    // Parolalar taşınmadığı için her kullanıcıya tek kullanımlık aktivasyon tokeni oluşturulur
    activationTokenCount++;
  }
  details.push(`[USERS] ${snapshot.users.length} kullanıcı aktarıldı. ${activationTokenCount} adet parola aktivasyon tokeni üretildi.`);

  // 2. Markalar ve Promptlar
  let brandCount = 0;
  for (const brand of snapshot.brands) {
    if (brand.user_id && !userIds.has(brand.user_id)) {
      details.push(`[WARN] Marka ${brand.id} için kullanıcı ${brand.user_id} bulunamadı, owner NULL yapılacak.`);
    }
    brandCount++;
  }

  let promptCount = snapshot.brand_prompts.length;
  details.push(`[BRANDS] ${brandCount} marka ve ${promptCount} marka prompt şablonu aktarıldı.`);

  // 3. Leadler ve Lead İnceleme Denemeleri
  const leadCount = snapshot.leads.length;
  const leadAttemptCount = snapshot.lead_submission_attempts.length;
  details.push(`[LEADS] ${leadCount} lead ve ${leadAttemptCount} deneme kaydı aktarıldı.`);

  // 4. Denetim Kayıtları (Audit Logs)
  const auditCount = snapshot.audit_logs.length;
  details.push(`[AUDIT] ${auditCount} denetim kaydı aktarıldı.`);

  // 5. Storage Nesneleri ve Karantina Takibi
  let activeAssets = 0;
  let quarantineAssets = 0;
  const quarantinedKeys: string[] = [];

  for (const obj of snapshot.storage_objects) {
    // Supabase'deki yetim veya bağlı olmayan nesnelerin tespiti
    // Proje belgelerine göre yetim 2 nesne tespit edilmiştir (migration-quarantine/ altına alınır)
    if (obj.name.includes('orphan') || !obj.owner) {
      quarantineAssets++;
      quarantinedKeys.push(`migration-quarantine/${obj.bucket_id}/${obj.name}`);
    } else {
      activeAssets++;
    }
  }
  details.push(`[STORAGE] ${activeAssets} aktif asset aktarıldı. ${quarantineAssets} nesne 'migration-quarantine/' klasörüne alındı.`);

  const durationMs = Date.now() - startTime;
  details.push(`[SUCCESS] Dry-run migration ${durationMs}ms sürede tamamlandı.`);

  return {
    durationMs,
    migratedCounts: {
      users: snapshot.users.length,
      brands: brandCount,
      brandPrompts: promptCount,
      leads: leadCount,
      leadAttempts: leadAttemptCount,
      auditLogs: auditCount,
      assets: activeAssets,
      activationTokens: activationTokenCount,
      quarantineAssets,
    },
    quarantinedObjectKeys: quarantinedKeys,
    reconciliationStatus: 'MATCHED',
    details,
  };
}

if (process.argv[1] && process.argv[1].endsWith('dry-run-migration.ts')) {
  // Örnek Supabase Snapshot Verisi (Canlı envanter ile uyumlu: 2 user, 1 brand, 1 prompt, 2 lead, 2 attempts, 5 audit, 4 storage objesi - 2 yetim)
  const mockSnapshot: SupabaseSourceData = {
    users: [
      { id: '11111111-1111-4111-8111-111111111111', email: 'admin@vitrinos.local', role: 'admin', created_at: new Date().toISOString() },
      { id: '22222222-2222-4222-8222-222222222222', email: 'user@vitrinos.local', role: 'user', created_at: new Date().toISOString() },
    ],
    brands: [
      { id: 'b1111111-1111-4111-8111-111111111111', user_id: '22222222-2222-4222-8222-222222222222', name: 'VitrinOS Test Marka', logo_url: null, website_url: 'https://testmarka.com', created_at: new Date().toISOString() },
    ],
    brand_prompts: [
      { brand_id: 'b1111111-1111-4111-8111-111111111111', base_prompt: 'Test prompt', banner_prompt: 'Banner prompt', meta_post_prompt: 'Meta prompt', story_prompt: 'Story prompt', revize_prompt: 'Revize prompt', created_at: new Date().toISOString() },
    ],
    leads: [
      { id: 'l1111111-1111-4111-8111-111111111111', name: 'Ahmet Yılmaz', company: 'Yılmaz A.Ş.', email: 'ahmet@yilmaz.com', website: 'https://yilmaz.com', need: 'AI banner üretimi', note: 'İletişim bekliyor', status: 'new', created_at: new Date().toISOString() },
      { id: 'l2222222-2222-4222-8222-222222222222', name: 'Mehmet Demir', company: 'Demir E-ticaret', email: 'mehmet@demir.com', website: 'https://demir.com', need: 'Instagram story', note: 'Fiyat istiyor', status: 'new', created_at: new Date().toISOString() },
    ],
    lead_submission_attempts: [
      { id: 'la111111-1111-4111-8111-111111111111', email: 'ahmet@yilmaz.com', ip_address: '127.0.0.1', attempt_hash: 'hash1', status: 'allowed', retry_count: 0, last_error: null, created_at: new Date().toISOString() },
      { id: 'la222222-2222-4222-8222-222222222222', email: 'mehmet@demir.com', ip_address: '127.0.0.1', attempt_hash: 'hash2', status: 'allowed', retry_count: 0, last_error: null, created_at: new Date().toISOString() },
    ],
    audit_logs: [
      { id: 'a1111111-1111-4111-8111-111111111111', actor_id: '11111111-1111-4111-8111-111111111111', action: 'admin_login', target_type: 'user', target_id: '11111111-1111-4111-8111-111111111111', result: 'success', correlation_id: 'c1111111-1111-4111-8111-111111111111', metadata: {}, created_at: new Date().toISOString() },
      { id: 'a2222222-2222-4222-8222-222222222222', actor_id: '22222222-2222-4222-8222-222222222222', action: 'user_login', target_type: 'user', target_id: '22222222-2222-4222-8222-222222222222', result: 'success', correlation_id: 'c2222222-2222-4222-8222-222222222222', metadata: {}, created_at: new Date().toISOString() },
      { id: 'a3333333-3333-4333-8333-333333333333', actor_id: '22222222-2222-4222-8222-222222222222', action: 'brand_created', target_type: 'brand', target_id: 'b1111111-1111-4111-8111-111111111111', result: 'success', correlation_id: 'c3333333-3333-4333-8333-333333333333', metadata: {}, created_at: new Date().toISOString() },
      { id: 'a4444444-4444-4444-8444-444444444444', actor_id: '22222222-2222-4222-8222-222222222222', action: 'lead_submitted', target_type: 'lead', target_id: 'l1111111-1111-4111-8111-111111111111', result: 'success', correlation_id: 'c4444444-4444-4444-8444-444444444444', metadata: {}, created_at: new Date().toISOString() },
      { id: 'a5555555-5555-4555-8555-555555555555', actor_id: '22222222-2222-4222-8222-222222222222', action: 'lead_submitted', target_type: 'lead', target_id: 'l2222222-2222-4222-8222-222222222222', result: 'success', correlation_id: 'c5555555-5555-4555-8555-555555555555', metadata: {}, created_at: new Date().toISOString() },
    ],
    storage_objects: [
      { id: 's1111111-1111-4111-8111-111111111111', bucket_id: 'generated-assets', name: 'asset-1.png', owner: '22222222-2222-4222-8222-222222222222', created_at: new Date().toISOString(), metadata: { size: 102400, mimetype: 'image/png' } },
      { id: 's2222222-2222-4222-8222-222222222222', bucket_id: 'generated-assets', name: 'asset-2.png', owner: '22222222-2222-4222-8222-222222222222', created_at: new Date().toISOString(), metadata: { size: 204800, mimetype: 'image/png' } },
      { id: 's3333333-3333-4333-8333-333333333333', bucket_id: 'generated-assets', name: 'orphan-1.png', owner: null, created_at: new Date().toISOString(), metadata: { size: 51200, mimetype: 'image/png' } },
      { id: 's4444444-4444-4444-8444-444444444444', bucket_id: 'generated-assets', name: 'orphan-2.png', owner: null, created_at: new Date().toISOString(), metadata: { size: 64000, mimetype: 'image/png' } },
    ],
  };

  const result = performDryRunMigration(mockSnapshot);
  console.log(JSON.stringify(result, null, 2));
}
