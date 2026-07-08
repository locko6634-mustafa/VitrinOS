# VitrinOS Mevcut Yapı Analizi

Analiz tarihi: 7 Temmuz 2026  
Kapsam: yerel HTML/CSS/JS/SQL dosyaları, `README.md`, n8n MCP workflow detayları, Supabase MCP canlı şema/policy/advisor çıktıları ve resmi OpenAI model dokümantasyonu.

## Yönetici Özeti

VitrinOS, landing page, müşteri paneli, admin paneli, Supabase veritabanı/storage ve n8n tabanlı görsel üretim otomasyonundan oluşan çalışır bir SaaS prototipi seviyesinde. Mimari yön doğru: frontend hafif, veri modeli anlaşılır, n8n workflowları format bazında ayrılmış ve Supabase RLS büyük ölçüde uygulanmış.

Canlıya çıkış önündeki ana engeller güvenlik ve işletilebilirlik tarafında: n8n webhook tarayıcıdan kimlik doğrulamasız tetikleniyor, `generated-assets` bucket public, canlı Supabase'deki admin/auth fonksiyonları migrationlarda yok ve `SECURITY DEFINER` olarak herkese execute açık, n8n hata yönetimi üretim seviyesinde değil. Bu başlıklar çözülmeden public SaaS yayını yapılmamalı.

## Doğrulanan Kaynaklar

- Yerel dosyalar: `index.html`, `dashboard.html`, `admin.html`, `login.html`, `js/config.js`, `js/supabase.js`, `js/dashboard.js`, `js/admin.js`, `js/lead-form.js`, `supabase/migrations/*.sql`.
- n8n MCP: `VitrinOS_BASE`, `VitrinOS_META_POST`, `VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_REVIZE`.
- Supabase MCP canlı proje: `wrzalebhnlwppufdcmiz`.
- Supabase advisors: security ve performance advisor çıktıları.
- OpenAI resmi model sayfaları: `gpt-5.4-mini`, `gpt-5-nano`, `gpt-image-2`.

## Güncel Mimari ve Veri Akışı

Landing page `index.html`, lead formunu `js/lead-form.js` ile doğruluyor ancak kaydı sadece `sessionStorage` içine demo kayıt olarak yazıyor. Supabase `leads` tablosu ve anon insert policy canlıda hazır olmasına rağmen form henüz doğrudan Supabase'e yazmıyor.

Login akışı `login.html` ve `js/login.js` üzerinden Supabase Auth `signInWithPassword` çağırıyor. `js/supabase.js`, oturum doğrulamasında `getSession` sonrası `getUser` kullanıyor ve admin yönlendirmesini `app_metadata.role` üzerinden yapıyor. Yetki kararında user-editable metadata kullanılmaması olumlu.

Dashboard `js/dashboard.js`, kullanıcı oturumu zorunlu kıldıktan sonra `brands` ve `jobs` verilerini Supabase'den çekiyor, yeni brief için önce `jobs` tablosuna `pending` kayıt açıyor, ardından `js/config.js` içindeki n8n webhook URL'sine browser-side POST atıyor. Sonuçlar Supabase Realtime `public:jobs` aboneliğiyle güncelleniyor.

Admin panel `js/admin.js`, canlı Supabase'den `brands`, `brand_prompts`, `users`, `leads`, `jobs` verilerini okuyup marka/prompt/lead/job yönetimi yapıyor. Ayrıca `invite_user` ve `toggle_user_status` RPC fonksiyonlarını çağırıyor. Bu fonksiyonlar canlı Supabase'de var fakat yerel migration klasöründe yok.

n8n tarafında `VitrinOS_BASE` tek public webhook giriş noktası olarak çalışıyor. Brief'i analiz edip format router ile `VitrinOS_META_POST`, `VitrinOS_STORY` veya `VitrinOS_BANNER` alt workflowuna gönderiyor; revizyon için `VitrinOS_REVIZE` çağrılıyor. Alt workflowlar OpenAI görsel üretim/edit ve `Jimp` ile boyutlandırma/logo işleme yapıyor.

## İyi Çalışan/Başarılı Alanlar

- Vanilla HTML/CSS/JS mimarisi sade ve deploy yüzeyi küçük. Build zinciri olmadığı için statik hosting ve hızlı prototip avantajı var.
- `js/supabase.js` merkezi Supabase client ve auth wrapper yaklaşımı doğru. `getUser` kullanımı, yalnızca local session objesine güvenmekten daha sağlıklı.
- Admin rolü `app_metadata.role` ile okunuyor. Bu, Supabase güvenlik yaklaşımı açısından `raw_user_meta_data` tabanlı yetkilendirmeden daha güvenli.
- Supabase ana tabloları RLS açık: `brands`, `brand_prompts`, `jobs`, `leads`, canlıda ayrıca `public.users`.
- Sıkılaştırılmış RLS migrationı, marka ve job okumalarında owner/admin ayrımını uyguluyor; prompt ve lead yönetimini admin tarafına kapatıyor.
- Dashboard ve admin Realtime abonelikleri, üretim sonucunu kullanıcıya polling olmadan taşımaya uygun bir yapı kuruyor.
- n8n workflowları görev bazında ayrılmış: BASE yönlendirici, format workflowları ve REVIZE workflowu. Bu ayrım ölçekleme ve debug için doğru.
- LLM çıktıları için JSON parse/fallback code node'ları var. Bu, model çıktısı bozulduğunda workflowun tamamen kontrolsüz kalmasını azaltıyor.
- Storage dosya limiti ve MIME kısıtı tanımlı: `generated-assets` için 10 MB ve `image/png`, `image/jpeg`, `image/webp`.
- OpenAI model stringleri için doğrulama yapıldı: `gpt-5.4-mini`, `gpt-5-nano` ve `gpt-image-2` resmi OpenAI docs içinde mevcut görünüyor. Bu nedenle model riski "kesin geçersiz model" değil; hesap erişimi, n8n node uyumluluğu, alias drift ve smoke test eksikliği riski.

## Kritik Riskler (High Priority)

### 1. n8n webhook tarayıcıdan açık ve kimlik doğrulamasız tetikleniyor

Kanıt: `js/config.js` içinde `n8nWebhookUrl` public olarak yer alıyor; `js/dashboard.js` yeni üretim ve revizyon için doğrudan `fetch(webhookUrl)` çağırıyor. n8n MCP `VitrinOS_BASE` webhook bilgisinde production path `/webhook/vitrinos-brief`, HTTP method `POST` ve "No credentials required" olarak doğrulandı.

Etki: URL'yi bilen herkes workflowu tetikleyebilir. Bu; OpenAI görsel üretim maliyeti, n8n compute kullanımı, Supabase job güncellemesi ve storage yazımı üzerinden DDoS/wallet drain riski oluşturur. Gövde içinde `jobId`, `userId`, `brandId` taşındığı için ownership doğrulaması backend tarafında yapılmadan workflow çalışması veri bütünlüğü riski de yaratır.

### 2. `generated-assets` bucket public ve n8n public URL yazıyor

Canlı Supabase MCP sonucu `generated-assets.public = true`. n8n BASE workflowu `image_url` alanına `/storage/v1/object/public/generated-assets/...` URL'si yazıyor. Migration da bucket'ı `public = true` oluşturuyor.

Etki: Üretilen marka görselleri ve potansiyel gizli kampanya kreatifleri URL bilindiğinde doğrudan erişilebilir. Storage metadata SELECT policy sıkı olsa bile public bucket içerik sızıntısı riskini ortadan kaldırmaz.

### 3. `SECURITY DEFINER` RPC fonksiyonları public schema içinde herkese executable

Canlı Supabase'de `handle_auth_user_change`, `invite_user`, `toggle_user_status` fonksiyonları `SECURITY DEFINER`. Advisor çıktısı, bu üç fonksiyonun hem `anon` hem `authenticated` rollerinden `/rest/v1/rpc/...` ile çalıştırılabilir olduğunu uyarı olarak raporladı.

Ek risk: `invite_user` fonksiyonu yeni kullanıcıyı doğrudan `auth.users` içine ekliyor ve sabit varsayılan parola (`Vitrinos123!`) kullanıyor. Fonksiyon içinde admin kontrolü var; ancak execute yetkisi daraltılmadığı için bu endpointler public saldırı yüzeyi olarak kalıyor.

### 4. Canlı Supabase şeması migration klasörüyle uyumsuz

Canlıda `public.users`, `handle_auth_user_change`, `invite_user`, `toggle_user_status` ve `auth.users` üzerindeki `on_auth_user_change` triggerı var. Yerel `supabase/migrations/` içinde bunların tanımı yok.

Etki: Yeni ortam kurulumu, staging, disaster recovery veya başka geliştirici kurulumu aynı şemayı üretemez. Admin panel canlıda çalışan RPC/table bağımlılıklarına sahipken migration history eksik kalır.

### 5. `jobs` RLS policy kullanıcıya kendi job satırlarında geniş UPDATE izni veriyor

Canlı policy `Jobs are updatable by owner or admin`, owner kullanıcının kendi job satırını güncellemesine izin veriyor. RLS satır bazında doğru; ancak kolon bazında status, `image_url`, `brief_json`, `revision_count` gibi alanları sınırlamıyor.

Etki: Authenticated bir kullanıcı tarayıcıdan Supabase client ile kendi job'unu `completed` yapabilir, `image_url` değiştirebilir veya üretim çıktısını manipüle edebilir. SaaS için onay/revizyon gibi kullanıcı aksiyonları ayrı RPC/Edge Function ile sınırlandırılmalı; n8n sonuç yazımı server credential ile yapılmalı.

### 6. n8n hata yönetimi üretim seviyesinde değil

MCP workflow detaylarında Error Trigger, merkezi hata workflowu veya sistematik failed-state güncelleme görünmedi. Execution geçmişinde `VitrinOS_BASE` için webhook/manual error kayıtları, `VitrinOS_META_POST` için error/canceled kayıtları, `VitrinOS_STORY` için error kaydı görüldü. `VitrinOS_BANNER` için execution geçmişi yok.

Etki: OpenAI, HTTP image download, Jimp, storage upload veya Supabase update hatasında job `processing` durumunda kalabilir. Kullanıcıya doğru hata mesajı gitmez; operasyon ekibi kök nedeni proaktif göremez.

### 7. Frontend'de untrusted veri HTML olarak parse edilerek render ediliyor

`js/admin.js` ve `js/dashboard.js` birçok yerde veritabanından veya LLM çıktısından gelen değerleri template string ile HTML olarak parse edilen render akışına basıyordu. Admin panel özellikle lead, brief, marka adı, website, job JSON ve prompt içerikleri gibi kullanıcı/LLM kaynaklı alanları render ediyor.

Etki: Kötü niyetli lead/brief/prompt içeriği admin tarayıcısında stored XSS'e dönüşebilir. Admin oturumunda çalışan XSS, marka/prompt/job yönetimini ve Supabase session'ını riske atar.

## Orta ve Düşük Riskler (Medium/Low Priority)

- Landing lead formu canlı veri yazmıyor. `leads` tablosu ve anon insert policy hazır; ancak `js/lead-form.js` sadece demo sessionStorage kaydı yapıyor.
- `select('*')` kullanımı var (`js/dashboard.js`, `js/admin.js`). Bu, gereksiz veri transferi ve gelecekte hassas kolon sızıntısı riskini artırır.
- Supabase CDN scripti `@supabase/supabase-js@2` major alias ile yükleniyor; exact version ve SRI yok. Production için paketlenmiş/pinlenmiş asset tercih edilmeli.
- Login ekranında demo kullanıcı adı prefilled: `locko6634admin`. Production'da kaldırılmalı.
- `leads` anon insert açık olduğu için captcha, rate limit ve abuse kontrolü yoksa spam riski var.
- n8n code node'ları `require('jimp')` kullanıyor. n8n instance external module izni, paket versiyonu ve deploy tekrarlanabilirliği netleştirilmeli.
- OpenAI image workflowlarında `quality: high` kullanılan dallar maliyetli olabilir. Public webhook ile birleştiğinde maliyet riski büyür.
- Realtime aboneliklerinde dashboard `brands` kanalını user filter olmadan dinliyor. RLS koruması olsa da gereksiz event yüzeyi ve performans maliyeti yaratabilir.
- Storage insert policy authenticated kullanıcılara `generated-assets` bucket içine path ownership kısıtı olmadan insert izni veriyor. Bucket private yapıldığında path bazlı owner/brand kontrolü de eklenmeli.
- Supabase performance advisor mevcut indekslerin çoğunu "unused" olarak raporladı. Veri az olduğu için bu şimdilik karar verdirici değil; ancak ileride `jobs(user_id, created_at desc)`, `jobs(brand_id, created_at desc)`, `leads(status, created_at desc)` gibi sorgu odaklı indeksler değerlendirilmeli.
- `public.users` için birden fazla permissive SELECT policy var; Supabase performance advisor bunu performans uyarısı olarak raporladı.
- Dashboard webhook `fetch` hatasını catch içinde loglayıp kullanıcı akışını başarılı gibi sürdürebiliyor. HTTP 4xx/5xx kontrolü ve timeout yok.
- n8n webhook response "Workflow got started" ile hemen dönüyor; frontend gerçek üretim kabulünü değil sadece tetiklemenin başladığını biliyor.

## İyileştirme ve Optimizasyon Önerileri

1. Public browser -> n8n doğrudan çağrısını kaldır. Supabase Edge Function veya küçük backend API üzerinden JWT doğrulaması, ownership check, rate limit ve secret header ile n8n tetikle.
2. `generated-assets` bucket'ını private yap. Veritabanında public URL yerine object path sakla; frontend için kısa süreli signed URL üret.
3. Canlıdaki `public.users`, auth trigger ve RPC fonksiyonlarını migrationa taşı. `SECURITY DEFINER` fonksiyonlarda execute yetkisini `PUBLIC`, `anon`, gerekmiyorsa `authenticated` rollerinden revoke et.
4. Kullanıcı job güncellemelerini doğrudan tablo UPDATE yerine dar RPC'lere böl: `approve_job(job_id)`, `request_revision(job_id, note)`. Bu RPC'ler sadece izin verilen kolonları değiştirmeli.
5. n8n workflowlarına merkezi Error Trigger ekle. Hata durumunda `jobs.status = failed`, `revision_note/error_message`, Slack/e-posta bildirimi ve retry stratejisi uygulanmalı.
6. OpenAI model setini production için standartlaştır. Bugün doğrulanan model stringleri geçerli görünse de n8n credential/model picker ve gerçek hesap erişimi ile smoke test yapılmalı; alias yerine gerekirse snapshot kullanılmalı.
7. HTML parse eden render akışları yerine DOM API (`textContent`, `createElement`) veya güvenli sanitizer kullan. Admin panelde lead/brief/prompt renderı öncelikli.
8. Lead formunu Supabase'e gerçek insert yapacak şekilde güncelle; captcha/rate-limit ekle.
9. CDN bağımlılıklarını pinle, mümkünse yerel bundle'a al; CSP ve SRI ekle.
10. Production gözlemlenebilirliği kur: Sentry, Supabase logs/advisors periyodik kontrolü, n8n execution alertleri, maliyet/usage dashboardu.
11. Deployment için staging-prod ayrımı, secret rotation, migration doğrulaması ve rollback runbooku oluştur.
