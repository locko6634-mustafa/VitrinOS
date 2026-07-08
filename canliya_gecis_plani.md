# VitrinOS Canlıya Geçiş Planı

Analiz tarihi: 7 Temmuz 2026  
Hedef: VitrinOS'u güvenli, pazarlanabilir ve işletilebilir bir SaaS ürünü olarak production yayına hazırlamak.

## Öncelik 1 - Kritik: Canlıya Çıkış Öncesi Şart

### 1. n8n webhook güvenliğini kapat

Etkilenen yerler: `js/config.js`, `js/dashboard.js`, n8n `VitrinOS_BASE`, Supabase Edge Function veya backend API.

Teknik adımlar:
- `n8nWebhookUrl` değerini frontend config'ten kaldır.
- Dashboard brief/revizyon submit akışını doğrudan n8n yerine backend/Edge Function endpointine gönder.
- Backend Supabase JWT ile kullanıcıyı doğrulasın; `jobId`, `brandId`, `userId` eşleşmesini DB'den kontrol etsin.
- n8n `VitrinOS_BASE` webhookuna API key, JWT veya HMAC header doğrulaması ekle.
- n8n tarafında bilinmeyen header/body için 401/403 dön; workflow maliyetli node'lara ulaşmadan dursun.
- Rate limit, idempotency key ve request body schema validation ekle.

### 2. Storage bucket'ı private yap ve signed URL mimarisine geç

Etkilenen yerler: Supabase `storage.buckets`, `storage.objects` policies, n8n BASE storage upload/update node'ları, `js/dashboard.js`, `js/admin.js`.

Teknik adımlar:
- Yeni migration ile `generated-assets` bucket için `public = false` yap.
- `jobs.image_url` yerine mümkünse `image_path` veya `storage_path` sakla.
- Frontend görsel gösteriminde signed URL üretimini backend/Edge Function üzerinden yap.
- Storage insert/update policy'lerini path ownership kuralıyla daralt: örn. `<brand_id>/<job_id>_revN.png`.
- n8n upload credential'ını server-side tut; public URL üretme adımını kaldır.

### 3. Supabase `SECURITY DEFINER` fonksiyonlarını kilitle

Etkilenen yerler: canlı Supabase `public.handle_auth_user_change`, `public.invite_user`, `public.toggle_user_status`, `admin.js`, yeni migration.

Teknik adımlar:
- Canlıdaki `public.users`, auth trigger ve üç fonksiyon için eksik migration oluştur.
- `handle_auth_user_change` için `EXECUTE` yetkisini `PUBLIC`, `anon`, `authenticated` rollerinden revoke et; fonksiyon trigger tarafından çalışmaya devam etmeli.
- `invite_user` ve `toggle_user_status` için public execute yetkisini kaldır; admin çağrısı gerekiyorsa yalnızca authenticated admin RPC veya Edge Function üzerinden çalıştır.
- `invite_user` içindeki sabit varsayılan parolayı kaldır; Supabase Auth Admin invite akışı veya tek kullanımlık reset linki kullan.
- Advisor uyarıları tekrar çalıştırılıp temizlenene kadar canlıya çıkma.

### 4. Job state bütünlüğünü düzelt

Etkilenen yerler: Supabase `jobs` policies, `js/dashboard.js`, n8n BASE update node'ları.

Teknik adımlar:
- Kullanıcıların `jobs` tablosunda doğrudan geniş UPDATE yapmasını kaldır.
- `approve_job(job_id)` ve `request_revision(job_id, note)` gibi dar RPC/Edge Function endpointleri oluştur.
- Bu endpointler sadece owner/admin kontrolü sonrası izin verilen kolonları değiştirsin.
- `status`, `image_url`, `brief_json`, `revision_count` gibi üretim sonucu alanları sadece n8n/backend credential ile güncellensin.
- Revizyon limiti yalnızca frontend değil, DB veya backend katmanında da enforce edilsin.

### 5. Lead formunu demo moddan çıkar

Etkilenen yerler: `index.html`, `js/lead-form.js`, Supabase `leads` tablosu ve RLS policy.

Teknik adımlar:
- `sessionStorage` demo kaydını kaldır.
- Form submit'te Supabase `leads` tablosuna `name`, `company`, `email`, `website`, `need`, `note`, `status = new` insert et.
- Client validation yanında backend/RLS `status = new` kontrolünü koru.
- Captcha, rate limit ve honeypot alanı ekle.
- Başarılı kayıt sonrası admin bildirim akışı kur: n8n, e-posta veya Slack.

### 6. n8n hata yönetimi ve failed-state akışını kur

Etkilenen yerler: tüm `VitrinOS_*` n8n workflowları, Supabase `jobs`, izleme kanalları.

Teknik adımlar:
- Merkezi Error Trigger workflowu oluştur.
- Her ana workflow hatasında ilgili `jobId` için `status = failed` ve açıklayıcı hata alanı yaz.
- OpenAI, HTTP download, Supabase upload/update ve Jimp code node'ları için timeout/retry ayarla.
- Slack/e-posta alarmı ekle.
- Execution retention ve PII/log redaction ayarlarını kontrol et.
- BANNER workflowu için gerçek integrated execution smoke test yap; mevcut MCP geçmişinde execution görünmüyor.

### 7. OpenAI model ve maliyet stratejisini standardize et

Etkilenen yerler: n8n OpenAI model node'ları, marka prompt şablonları, deployment runbook.

Teknik adımlar:
- Mevcut n8n'de görülen `gpt-5.4-mini`, `gpt-5-nano`, `gpt-image-2` model stringleri resmi docs'ta mevcut görünüyor; yine de n8n credential ve hesap erişimiyle production smoke test yap.
- Kritik prompt/analiz işleri için tek standart text model seç; maliyet odaklı alt adımlar için düşük maliyetli model seçimini belgeleyin.
- Görsel üretim/edit için `gpt-image-2` kalite ayarlarını format bazında maliyet testine sok.
- Alias drift istenmiyorsa snapshot model ID kullan.
- Kullanıcı talimatındaki `gpt-4o` / `gpt-4o-mini` gibi alternatifler tercih edilecekse, önce güncel OpenAI docs ve n8n picker üzerinden erişilebilirlik doğrulanmalı.

### 8. XSS ve frontend güvenlik sertleştirmesini yap

Etkilenen yerler: `js/admin.js`, `js/dashboard.js`, tüm HTML dosyaları, hosting headerları.

Teknik adımlar:
- DB/LLM/user kaynaklı verilerin HTML olarak parse edildiği render noktalarını DOM API veya sanitizer ile değiştir.
- Admin panelde lead, brief, prompt, job JSON ve marka alanlarını önceliklendir.
- CSP header ekle; inline style/script kullanımını azalt.
- Supabase CDN scriptini exact version ile pinle veya bundle'a al; SRI ekle.
- Login ekranındaki prefilled demo kullanıcı adını kaldır.

## Öncelik 2 - Orta: SaaS Ticarileştirme ve İzleme

### 1. Abonelik ve kredi/limit sistemi kur

Etkilenen yerler: Supabase schema, dashboard, admin panel, n8n BASE, ödeme sağlayıcı.

Teknik adımlar:
- `plans`, `subscriptions`, `usage_credits`, `usage_events` tablolarını tasarla.
- Stripe veya tercih edilen ödeme sağlayıcıyla checkout, webhook ve subscription status sync kur.
- n8n tetiklemeden önce kredi/limit kontrolü yap.
- Her OpenAI görsel/text üretimi için usage event yaz.
- Admin panelde marka bazlı aylık kullanım ve kalan kredi görünümü ekle.

### 2. Güvenli sign-up ve onboarding ekle

Etkilenen yerler: `login.html`, yeni kayıt ekranı, Supabase Auth, `public.users`, `brands`.

Teknik adımlar:
- Public sign-up veya invite-only kayıt kararını netleştir.
- E-posta doğrulama, güçlü parola, leaked password protection ve gerektiğinde MFA ayarlarını aç.
- İlk marka oluşturma/onboarding akışı ekle.
- Admin invite akışını sabit parola yerine Supabase invite/reset mekanizmasına taşı.

### 3. İzleme, analitik ve alarm sistemi kur

Etkilenen yerler: frontend, n8n, Supabase, hosting.

Teknik adımlar:
- Frontend hata izleme için Sentry veya eşdeğer araç ekle.
- n8n Error Trigger'dan Slack/e-posta bildirimleri gönder.
- Supabase advisors/security lint kontrolünü periyodik çalışma haline getir.
- Temel ürün analitiği kur: lead conversion, job start, job completed, approval, revision.
- Maliyet dashboardu oluştur: OpenAI image/text maliyeti, workflow hata oranı, ortalama üretim süresi.

### 4. Deployment ve secret yönetimini kurumsallaştır

Etkilenen yerler: hosting, n8n, Supabase, repo yapılandırması.

Teknik adımlar:
- Production/staging ayrımı oluştur.
- Supabase project ref, publishable key, n8n internal URL ve secret'ları env yönetimine taşı.
- Service role ve n8n credential rotasyon planı oluştur.
- Migration apply/check adımlarını release checklist'e ekle.
- Rollback ve incident runbook yaz.

### 5. Veri erişimini ve sorguları optimize et

Etkilenen yerler: `js/dashboard.js`, `js/admin.js`, Supabase indeksleri.

Teknik adımlar:
- `select('*')` çağrılarını açık kolon listelerine çevir.
- Dashboard için `jobs(user_id, created_at desc)` ve admin filtreleri için ihtiyaç bazlı composite indexleri veri büyüyünce ekle.
- Advisor'ın "unused index" uyarılarını veri hacmi artana kadar izleme listesinde tut; hemen indeks silme.
- Realtime aboneliklerini mümkün olduğunca filtreli hale getir.

## Öncelik 3 - Düşük: Lansman Sonrası ve Operasyonel Olgunluk

### 1. SEO, domain ve SSL tamamla

Etkilenen yerler: `index.html`, hosting, DNS.

Teknik adımlar:
- Production domain, SSL ve www/non-www yönlendirmelerini ayarla.
- `title`, `description`, Open Graph, canonical ve sitemap ekle.
- Landing page form conversion ölçümünü analitik event olarak takip et.

### 2. Yedekleme ve veri saklama planı oluştur

Etkilenen yerler: Supabase DB, Storage, n8n workflow exportları.

Teknik adımlar:
- Supabase backup sıklığını ve restore test periyodunu belirle.
- Storage object lifecycle ve retention politikasını yaz.
- n8n workflow JSON exportlarını versiyonlu sakla.
- Kullanıcı verisi silme/anonimleştirme prosedürü oluştur.

### 3. Ürün ve operasyon dokümantasyonu yaz

Etkilenen yerler: repo dokümantasyonu, admin runbook, müşteri destek süreçleri.

Teknik adımlar:
- Kurulum, migration, n8n import, credential setup ve smoke test adımlarını README veya ayrı runbooka taşı.
- Admin kullanıcı yönetimi, lead onayı, marka prompt güncelleme ve incident müdahale adımlarını belgeleyin.
- Müşteri destek şablonları ve SLA beklentileri oluştur.

### 4. Görsel kalite ve maliyet optimizasyonu iterasyonları yap

Etkilenen yerler: n8n format workflowları, `brand_prompts`, admin prompt ekranı.

Teknik adımlar:
- Banner, Story ve Meta Post için altın örnek setleri oluştur.
- Prompt değişikliklerini versiyonla; hangi promptun hangi outputu ürettiğini `jobs.brief_json` veya ayrı audit tabloda sakla.
- High/low quality image ayarlarını format ve müşteri planına göre kademelendir.
- İnsan onay oranı, revizyon oranı ve üretim süresi metriklerine göre promptları optimize et.

## Canlıya Çıkış Kararı İçin Minimum Kabul Kriterleri

- Public n8n webhook doğrudan browser'dan çağrılmıyor.
- Storage private ve frontend signed URL kullanıyor.
- Supabase security advisor'daki `SECURITY DEFINER` execute uyarıları temizlenmiş.
- Canlı Supabase şeması migrationlardan tekrar üretilebiliyor.
- Job state değişiklikleri dar backend/RPC akışlarıyla kontrol ediliyor.
- Lead formu gerçek kayıt yapıyor ve abuse koruması var.
- n8n hata akışı job'u `failed` durumuna düşürüyor ve operasyon ekibini uyarıyor.
- Tüm format workflowları için gerçek uçtan uca smoke test sonucu başarılı.
