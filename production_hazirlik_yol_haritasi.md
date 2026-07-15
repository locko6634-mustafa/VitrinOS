# VitrinOS Production Hazırlık Yol Haritası

**Hedef:** VitrinOS'u güvenli, yeniden üretilebilir, gözlemlenebilir ve pazarlanabilir çok kiracılı bir SaaS olarak canlıya almak.  
**Kaynak analiz:** `mevcut_yapi_analizi.md`  
**Değişiklik ilkesi:** Supabase ve n8n production değişiklikleri ayrı onay, yedek/export, kontrollü rollout ve rollback kanıtı olmadan uygulanmamalıdır.

## Go-Live Kararı

Mevcut karar: **NO-GO**.

Genel erişim ve ücretli müşteri kabulünden önce P0 kapıları tamamlanmalıdır. P1 maddeleri kapalı beta öncesi, P2 ürünleşme maddeleri ticari lansman öncesi tamamlanmalıdır.

## P0 — Güvenlik ve Veri Bütünlüğü Kapıları

### P0.1 Canlı altyapıyı repository ile uzlaştır

**Amaç:** Production ortamını tek kaynaktan yeniden kurabilmek.

Yapılacaklar:

1. Canlıdaki 27 migrationı yerel 24 dosya ile eşleştiren drift tablosu çıkar.
2. Canlıda olup yerelde olmayan Storage cleanup queue, metric timestamp ve diğer migrationları yeni, sıralı SQL kaynakları olarak repository'ye al.
3. `storage-cleanup-worker` kaynak kodunu ve `[functions.storage-cleanup-worker] verify_jwt=true` kaydını ekle.
4. Boş migration dosyasını açıklamalı no-op veya doğru migration içeriğiyle çöz.
5. Edge Function deploy manifestini source SHA, bundle SHA, live version ve git SHA ile CI'da üret.
6. İzole Supabase branch üzerinde sıfırdan migration + function deploy provası çalıştır.

Kabul kriterleri:

- Yerel migration listesi ile canlı history birebir izlenebilir.
- Boş/elle uygulanmış migration kalmaz.
- Beş canlı functionın tamamı repository'den aynı hash ile üretilebilir.
- Restore drill yeni branch üzerinde geçer.

Rollback: Production'a DDL uygulanmadan önce schema dump ve function bundle exportu alınır; yalnızca ileri yönlü telafi migrationı kullanılır.

### P0.2 Admin MFA/AAL2 zorunluluğu

**Amaç:** Admin parolası ele geçirilse bile kritik yetki kullanımını engellemek.

Yapılacaklar:

1. Login sonrası admin ve bağlı TOTP için challenge ekranı ekle.
2. `requireAdmin()` içinde `currentLevel === aal2` kontrolü zorunlu yap.
3. `admin-user-actions` bütün actionlarında JWT AAL2 doğrulaması yap.
4. Admin RLS yardımcılarında veya kritik RPC katmanında `aal2` savunma katmanı ekle.
5. Recovery code, kayıp cihaz ve admin kilitlenmesi runbooku hazırla.
6. AAL1 admin tokenıyla negatif, AAL2 tokenıyla pozitif entegrasyon testi yaz.

Kabul kriterleri:

- AAL1 admin `admin.html` ve admin Edge Function işlemlerine erişemez.
- AAL2 oturumu kritik işlemleri tamamlar.
- Ban/session revoke sonrası eski token kritik işlem yapamaz.

### P0.3 Atomik ve idempotent üretim dispatchi

**Amaç:** Aynı job için tek ücretli üretim çalıştırmak.

Önerilen state machine:

`pending/revision_requested → dispatching → processing → completed | failed`

Yapılacaklar:

1. Joba `dispatch_token`, `dispatch_attempt`, `dispatch_started_at`, `last_error_code` alanları veya ayrı dispatch tablosu ekle.
2. `reserve_job_dispatch(job_id, user_id, expected_status)` RPC'si koşullu update ile yalnızca bir çağrıyı kazandırmalı.
3. Edge Function, n8n'e `dispatch_token` ve correlation ID göndermeli.
4. n8n status update sorguları `job_id + dispatch_token + expected_status` ile koşullu olmalı.
5. Tamamlama/başarısızlık settlementi idempotent olmalı.
6. Edge Function timeoutunda aynı job ile retry güvenli olmalı; yeni job yaratılmamalı.
7. Eşzamanlı 10 çağrılık yarış testi yazılmalı ve tek n8n execution kanıtlanmalı.

Kabul kriterleri:

- Aynı job için en fazla bir aktif dispatch.
- Tek Storage final objesi ve tek ücretli model zinciri.
- Network timeout sonrası güvenli yeniden deneme.
- Stuck `dispatching/processing` job için otomatik recovery politikası.

### P0.4 Dış görsel URL/SSRF savunması

**Amaç:** n8n sunucusunun keyfi dış/iç URL'lere erişmesini engellemek.

Tercih edilen akış:

1. Kullanıcı ürünü doğrudan private `source-assets` bucketına yükler.
2. Edge Function dosya boyutu, MIME, magic bytes, çözünürlük ve zararlı içerik kontrollerini yapar.
3. Job yalnızca doğrulanmış object path taşır.
4. n8n yalnızca Supabase Storage originine ve ilgili path'e erişir.

Geçici savunmalar:

- Yalnızca HTTPS.
- Domain allowlist.
- Redirect kapalı veya her hopta tekrar doğrulama.
- DNS çözümleme sonrası private, loopback, link-local, multicast ve metadata IP engeli.
- İndirme boyutu, süre ve content-type limiti.
- n8n host egress allowlist/firewall.

Kabul kriterleri:

- `127.0.0.1`, RFC1918, link-local ve cloud metadata URL testleri bloklanır.
- Oversize/non-image payload n8n'e ulaşmaz.
- Onaylı Storage görseli üç formatta başarıyla üretilir.

### P0.5 Güvenli kullanıcı silme sagası

**Amaç:** Kullanıcı silme başarısız olduğunda aktif hesaba ait assetlerin silinmemesi.

Yapılacaklar:

1. Silme isteğini benzersiz saga ID ile audit loga yaz.
2. Asset yollarını `awaiting_parent_delete` durumunda snapshotla.
3. Oturumları revoke et ve auth kullanıcısını sil.
4. Yalnızca auth silme başarıyla doğrulanınca queue kayıtlarını `pending` yap.
5. Auth silme başarısızsa queue kayıtlarını iptal et.
6. Worker her objeyi silmeden önce saga durumunu doğrulasın.
7. Dead-letter ve manuel yeniden işleme ekranı ekle.

Kabul kriterleri:

- Zorlanmış auth silme hatasında hiçbir asset silinmez.
- Başarılı silmede job/brand/asset yaşam döngüsü politika ile uyumlu tamamlanır.
- Her adım audit log ve correlation ID ile izlenebilir.

### P0.6 Çalışan gözlemlenebilirlik ve alarm

**Amaç:** Sessiz production hatasını ortadan kaldırmak.

Yapılacaklar:

1. Runtime config'e public Sentry DSN, environment, release ve örnekleme değerlerini ekle.
2. CSP'ye yalnızca gerekli Sentry script/connect originlerini ekle veya SDK'yı bundle et.
3. Correlation ID'yi `jobs`/dispatch/audit kayıtlarına ve n8n execution metadata zincirine taşı.
4. Kullanıcı hata kodunu iç teknik hata ayrıntısından ayır.
5. n8n'de ayrı `VitrinOS_OPS_ALERT` workflowunu manuel olarak oluştur.
6. Alarm eşikleri: 5 dakikada 3 failed job, 15 dakika processing, cleanup dead-letter, Edge Function 5xx artışı.

Kabul kriterleri:

- Kontrollü frontend hatası Sentry'de release ve correlation ID ile görünür.
- Kontrollü n8n hatası jobu güvenli hata koduyla kapatır ve alarm üretir.
- Alarm payloadında PII, prompt, token ve signed URL bulunmaz.

## P1 — Dayanıklılık, Test ve Operasyon

### P1.1 n8n reliability standardı

- Dış API ve Storage düğümlerinde geçici 429/5xx/ağ hatalarına en fazla üç retry.
- Exponential backoff ve jitter.
- Supabase 10 sn, webhook orchestration 30 sn, görsel üretim 180 sn başlangıç timeoutları; gerçek ölçümle ayarlanmalı.
- Retry edilmemesi gereken 4xx/validation/auth hataları ayrı sınıflanmalı.
- Beş workflow için JSON export, checksum ve değişiklik kaydı tutulmalı.
- İlk sentetik brief ve kontrollü hata execution kanıtı release'e bağlanmalı.

### P1.2 Veri ve UI tutarlılığı

- `leads` için Realtime gereksinimi varsa publicationa ekle; yoksa ölü frontend aboneliğini kaldır.
- Ortalama süreyi `completed_at - processing_started_at` ile hesapla.
- Marka uyumunu `brand_match_score` üzerinden göster; veri yoksa “ölçülmedi” yaz.
- Marka+prompt kaydını tek transaction RPC/Edge Functiona taşı.
- Lead invite ve status geçişini idempotent saga yap.
- Teknik hata metnini kullanıcıya göstermeyip stable hata kodu/destek correlation ID göster.

### P1.3 Güvenlik ayarları

- Supabase leaked password protectionı plan/uygunluk doğrulaması sonrası aç.
- Minimum parola ve reauthentication politikasını belirle.
- CORS headerını request originine göre üret; allowlist boşsa fail-closed kal.
- Admin audit loga `requested/succeeded/failed` olaylarını bütün kritik actionlarda yaz.
- Audit, lead attempt ve job verileri için saklama sürelerini onayla.
- Vercel canlı response headerında HSTS ve CSP'yi otomatik test et.

### P1.4 Test piramidi

Zorunlu testler:

- SQL: RLS owner/admin/anon negatif ve pozitif senaryoları.
- Auth: AAL1/AAL2, ban, session revoke, invite ve recovery.
- Edge: origin, JWT, service role isolation, validation, timeout ve idempotency.
- n8n contract: payload schema, HMAC, format router, revision limit ve error settlement.
- Browser E2E: landing lead, login, admin MFA, brief, Realtime sonuç, onay, üç revizyon.
- Güvenlik: SSRF payloadları, oversize upload, XSS metinleri ve rate-limit yarışı.
- Recovery: migration replay, function deploy, Storage objesi ve n8n export restore.

CI kapısı:

- Unit/integration/E2E başarılı.
- Migration lint ve Supabase advisor yüksek seviye bulgusuz.
- `npm audit --audit-level=high` başarılı.
- Secret scan ve SRI/CSP kontrolü başarılı.
- Drift kontrolü sıfır.

## P2 — Ticari SaaS Ürünleşmesi

### P2.1 Çok kiracılı veri modeli

Önerilen çekirdek:

- `organizations`
- `organization_memberships`
- `organization_roles` veya sabit role enumu
- `brands.organization_id`
- `jobs.organization_id`
- `subscriptions`
- `entitlements`
- `usage_ledger`
- `billing_events`

Kurallar:

- Tenant kimliği client body'den güvenilerek alınmamalı; üyelik/RLS ile türetilmeli.
- Admin rolü platform admini ile organization admini olarak ayrılmalı.
- Usage ledger append-only ve idempotency keyli olmalı.
- Her ücretli üretim rezervasyon, settlement ve refund/credit durumuna sahip olmalı.

### P2.2 Paket, kota ve maliyet kontrolü

- Plan bazlı marka, kullanıcı, aylık üretim, çözünürlük ve revizyon limitleri.
- Dispatch öncesi atomik kota rezervasyonu.
- Başarısız model zincirinde otomatik kota iadesi.
- Model/format başına maliyet ve marj metriği.
- Harcama tavanı ve anomali alarmı.
- Billing webhooklarında imza doğrulama ve idempotent event tablosu.

### P2.3 Self-servis müşteri deneyimi

- Kayıt/e-posta doğrulama/organization oluşturma.
- Marka sihirbazı: logo, renk, ton, yasak kelime ve örnek görseller.
- Ekip daveti ve rol yönetimi.
- Kullanım/kota/fatura ekranı.
- Asset indirme, arşiv ve hesap kapatma.
- Destek ekranında correlation ID ve durum sayfası bağlantısı.

### P2.4 Hukuk ve güven

- KVKK/Gizlilik Politikası.
- Kullanım Koşulları ve kabul kaydı.
- Veri işleyen/alt işleyen listesi.
- AI içerik, marka ve fikri mülkiyet hükümleri.
- Veri saklama/silme ve DSR süreci.
- Güvenlik iletişim ve olay bildirim prosedürü.
- Gerekliyse cookie consent; yalnızca gerçekten kullanılan non-essential cookie/telemetri için.

## Production SLO ve Kapasite Hedefleri

İlk beta için önerilen ölçülebilir hedefler:

| Alan | Hedef |
|---|---|
| API/Edge aylık erişilebilirlik | ≥ %99,9 |
| Dispatch kabul p95 | < 3 sn |
| Görsel üretim p95 | Gerçek model ölçümü sonrası, başlangıç hedefi < 180 sn |
| Aynı job çift dispatch | 0 |
| 15 dk üzeri processing job | 0; otomatik alarm/recovery |
| Kritik alarm algılama | < 5 dk |
| RPO | ≤ 24 saat |
| RTO | ≤ 60 dk |
| Kritik güvenlik bulgusu | 0 açık bulgu |

Hedefler yük testi ve gerçek beta trafiğiyle yeniden kalibre edilmelidir.

## Aşamalı Yayın Planı

### Aşama A — İzole doğrulama

- Yeni Supabase branch/izole proje.
- Repository'den tam kurulum.
- Sentetik tenant ve veri.
- SSRF, auth, RLS, dispatch yarış ve restore testleri.

### Aşama B — İç alpha

- Yalnızca şirket hesapları.
- Düşük günlük harcama tavanı.
- Tüm alarm ve dashboardlar aktif.
- Bir hafta hatasız dispatch ve cleanup gözlemi.

### Aşama C — Davetli beta

- Az sayıda gerçek müşteri.
- Sözleşme/KVKK metinleri aktif.
- Plan/kota ölçümü etkin; ödeme gerekiyorsa testten production webhooka kontrollü geçiş.
- Haftalık restore kanıtı ve olay değerlendirmesi.

### Aşama D — Genel erişim

- P0/P1 kapalı.
- Kritik/yüksek güvenlik bulgusu yok.
- SLO dashboardları ve on-call hazır.
- Faturalama mutabakatı ve müşteri destek süreci doğrulanmış.

## Nihai Go-Live Kontrol Listesi

- [ ] Canlı/yerel migration drift sıfır.
- [ ] Beş Edge Function repository'den yeniden deploy edilebilir.
- [ ] Admin işlemleri AAL2 olmadan reddediliyor.
- [ ] Dispatch yarış testi tek execution üretiyor.
- [ ] Arbitrary URL/SSRF testleri bloklanıyor.
- [ ] Kullanıcı silme hata senaryosu asset kaybetmiyor.
- [ ] n8n retry, timeout ve ayrı alarm workflowu doğrulandı.
- [ ] Sentry/log/alarm correlation ID ile çalışıyor.
- [ ] RLS ve Storage negatif testleri geçti.
- [ ] Leaked password protection kararı uygulanıp belgelendi.
- [ ] Realtime publication frontend davranışıyla uyumlu.
- [ ] E2E üretim/onay/revizyon akışı geçti.
- [ ] Kota, maliyet ve çift ücret engeli doğrulandı.
- [ ] KVKK/Gizlilik/Kullanım Koşulları yayınlandı.
- [ ] Restore drill RPO/RTO hedefini geçti.
- [ ] Rollback sahibi, on-call ve iletişim kanalı belirlendi.

Tüm kutular kanıt bağlantısı, sorumlu ve tarih olmadan tamamlanmış sayılmamalıdır.
