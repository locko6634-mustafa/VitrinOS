# VitrinOS - Mevcut Yapı Analiz Raporu

Bu rapor, VitrinOS projesinin yerel kod tabanı (HTML, CSS, JS, SQL migration), canlı Supabase backend yapılandırması ve n8n orkestrasyon iş akışları üzerinde gerçekleştirilen dinamik keşif, kod incelemesi ve canlı testler sonucunda hazırlanmıştır.

---

## 1. Kapsam ve Kullanılan Keşif Yöntemleri
Analiz sürecinde aşağıdaki dinamik keşif ve doğrulama yöntemleri kullanılmıştır:
- **Yerel Kod Taraması:** Proje dizinindeki tüm HTML, CSS, JavaScript ve PostgreSQL migration dosyaları taranmış, veri akışı ve istemci yapılandırmaları incelenmiştir.
- **Canlı Supabase Envanter Kontrolü:** `supabase` MCP sunucusu aracılığıyla canlı veritabanı şeması, etkin Row Level Security (RLS) politikaları, veritabanı tetikleyicileri ve Edge Function durumları sorgulanmıştır.
- **n8n İş Akışı Analizi:** `n8n-mcp` aracı kullanılarak sunucudaki 5 aktif iş akışının (`VitrinOS_BASE`, `VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_META_POST`, `VitrinOS_REVIZE`) JSON tanımları, düğüm yapıları, model seçimleri ve veri dönüştürme kodları çıkarılmıştır.

---

## 2. Mimari Özet
VitrinOS sistemi, istemci-sunucu-orkestrasyon üçgeninde modüler ve gevşek bağlı (loosely coupled) bir mimariye sahiptir:

- **Frontend (Vanilla HTML/CSS/JS):** `index.html`, `login.html`, `dashboard.html` ve `admin.html` sayfalarından oluşur. Supabase JS SDK (`js/supabase.js`) kullanılarak doğrudan veritabanı okuma/ekleme işlemleri ve realtime abonelikleri yönetilir.
- **Supabase Backend:** `brands`, `brand_prompts`, `jobs`, `leads`, `users` ve `lead_submission_attempts` tablolarından oluşur. RLS politikaları ile korunmaktadır. Edge Function'lar (`submit-lead`, `trigger-brief`, `job-actions`, `admin-user-actions`) hassas orkestrasyon ve dış sistem entegrasyonu görevlerini üstlenir.
- **n8n Orkestrasyon Akışı:** Görsel üretim brieflerini normalize eden, uygun formata (Story, Banner, Meta Post, Revize) yönlendiren ve OpenAI modelleri ile Jimp görsel işleme kütüphanesini kullanarak son görseli üreten 5 adet aktif iş akışından oluşur.
- **Storage:** Üretilen görseller private `generated-assets` bucket'ı altında saklanır ve istemcilere imzalı URL'ler (`signed URLs`) ile güvenli şekilde dağıtılır.

---

## 3. İyi Çalışan ve Başarılı Tasarlanmış Alanlar
Projede güvenlik, performans ve mimari açıdan doğru kurgulanmış başlıca alanlar şunlardır:
1. **İmzalı Webhook Güvenliği (HMAC):** [trigger-brief](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/trigger-brief/index.ts) Edge Function'ı ile n8n [VitrinOS_BASE](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/config.toml) webhook'u arasındaki iletişim SHA-256 HMAC imzası (`x-vitrinos-signature`) ve zaman damgası (`x-vitrinos-timestamp`) ile korunmaktadır. 5 dakikalık zaman toleransı sayesinde replay (yeniden oynatma) saldırıları önlenmektedir.
2. **Güvenli Storage Tasarımı:** `generated-assets` bucket'ı canlı ortamda private (`public: false`) olarak yapılandırılmıştır. [supabase.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/supabase.js#L123-L146) istemci tarafında imzalı URL'leri önbelleğe (cache) alarak gereksiz API çağrılarını önlerken, RLS politikaları ile kullanıcıların yalnızca kendi markalarına ait görsel metadatalarını görebilmeleri garanti altına alınmıştır.
3. **Kısıtlı Client-Side Güncellemeleri:** Kullanıcıların `jobs` tablosunda doğrudan UPDATE yapma yetkisi tamamen kaldırılmış (`revoke update`), güncellemeler yalnızca `service_role` kullanan [job-actions](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/job-actions/index.ts) Edge Function'ı veya RPC'ler üzerinden güvenli kontrol noktalarından geçerek yapılmaktadır.
4. **Verimli Realtime Abonelikleri:** [dashboard.js:L903-922](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/dashboard.js#L903-L922) üzerinde `user_id` filtresi kullanılarak yalnızca mevcut kullanıcıya ait işlerin anlık değişimleri dinlenmekte, veritabanı ve istemci kaynakları optimum düzeyde kullanılmaktadır.
5. **Gelişmiş Lead Formu Güvenliği:** [submit-lead](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/submit-lead/index.ts) Edge Function'ında honeypot (companyFax), form doldurma süresi (min 3 sn), IP/E-posta bazlı saatlik/günlük rate limit ve parmak izi bazlı mükerrer başvuru (duplicate) korumaları aktif edilmiştir.

---

## 4. Kritik Riskler (P0)

### 4.1. n8n OpenAI Geçersiz Model Adları Uyumsuzluğu
- **Bulgu:** n8n iş akışlarında kullanılan model isimleri resmi olarak mevcut olmayan veya yanlış yazılmış değerlere sahiptir.
  - `VitrinOS_BASE` iş akışındaki `OpenAI_Dil_Modeli` düğümünde model adı **`gpt-5.4-mini`** olarak ayarlanmıştır.
  - `VitrinOS_STORY`, `VitrinOS_BANNER` ve `VitrinOS_META_POST` iş akışlarındaki OpenAI Chat düğümlerinde model adı **`gpt-5-nano`** olarak ayarlanmıştır.
  - Tüm bu alt akışlardaki OpenAI DALL-E görsel üretim/düzenleme düğümlerinde model adı **`gpt-image-2`** olarak seçilmiştir.
- **Etki:** OpenAI API'si bu geçersiz model adlarını reddedecek ve "Model not found" hatası fırlatarak tüm görsel üretim akışlarının anında başarısız olmasına sebep olacaktır.

### 4.2. n8n Hata Yönetiminde Boş UUID / Supabase Yazma Hatası
- **Bulgu:** `VitrinOS_BASE` iş akışındaki `Hata_Bilgilerini_Hazirla` Code düğümü, webhook gövdesinden `jobId` parametresini çekmeye çalışmaktadır. Eğer hata henüz webhook alınmadan önce (örn: `API_Guvenlik_Filtresi` aşamasında veya imza doğrulanırken) ya da webhook verisi manipüle edilmişse tetiklenirse, `jobId` değeri boş kalmakta (`jobId = ""`) ve `Supabase_Hata_Yaz` düğümüne iletilmektedir.
- **Etki:** Supabase PostgreSQL veritabanı, boş stringi UUID tipine çeviremediği için "invalid input syntax for type uuid" hatası verecek ve asıl hata loglanamayacaktır. Sistem durumunun `failed` olarak güncellenmesi başarısız olacağı için işlem `processing` durumunda asılı kalacaktır.

---

## 5. Orta Riskler (P1)

### 5.1. Veritabanı Migration ve Canlı DB Drifti
- **Bulgu:** Canlı Supabase veritabanında `apply_job_revision_request` RPC fonksiyonu aktif olarak bulunmasına ve [job-actions:L126](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/job-actions/index.ts#L126) edge function'ı tarafından çağrılmasına rağmen; yerel `supabase/migrations/` dizininde bu fonksiyonun tanımlandığı herhangi bir migration dosyası yoktur. Yerelde yalnızca drop edilmiş eski `request_job_revision` fonksiyonunun referansları yer almaktadır.
- **Etki:** Local/Docker üzerinde yeni bir geliştirme ortamı ayağa kaldırıldığında migration'lar eksik kalacak ve lokal testlerde `apply_job_revision_request` bulunamadığı için revizyon akışı çökecektir.

### 5.2. Jimp Bağımlılığı ve n8n Ortam Hata Toleransı
- **Bulgu:** n8n alt akışlarındaki JavaScript Code düğümlerinde görsel boyutlandırma ve logo kompozisyonu için `require('jimp')` kullanılmaktadır.
- **Etki:** n8n sunucusunda `NODE_FUNCTION_ALLOW_EXTERNAL=jimp` çevre değişkeni tanımlanmamışsa veya sunucu ortamında `jimp` kütüphanesi kurulu değilse bu düğümler çökecektir. Ayrıca logo indirme (`Jimp.read(logo_url)`) işlemlerinde ağ hatası oluşursa tüm workflow catch mekanizması olmadan çökecek ve job'lar yarıda kalacaktır.

---

## 6. Düşük Riskler (P2)

### 6.1. Prefill / Demo Giriş Simülasyonu Eksikliği
- **Bulgu:** [login.html](file:///c:/Users/Mustafa/Desktop/VitrinOS/login.html) üzerinde demo giriş ekranına yönelik açıklamalar bulunmasına rağmen, [login.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/login.js) dosyasında demo hesap bilgileriyle otomatik doldurma (prefill) veya local/session storage simülasyonu kurgulanmamıştır. Kullanıcı her defasında manuel veri girmek zorundadır.
- **Etki:** Demo/Test kullanıcı deneyimini (UX) düşürmektedir.

### 6.2. submit-lead CORS Denetim Toleransı
- **Bulgu:** [submit-lead](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/submit-lead/index.ts#L138) fonksiyonunda `LEAD_ALLOWED_ORIGINS` çevre değişkeni boş bırakılırsa origin doğrulaması bypass edilmektedir. corsHeaders nesnesindeki `Access-Control-Allow-Origin: "*"` tanımı nedeniyle lead formu internet üzerindeki her siteden tetiklenebilir duruma gelmektedir.
- **Etki:** Canlı ortamda env değişkeni set edilmezse spam lead gönderimleri kolaylaşabilir.

---

## 7. Mimari İyileştirme Önerileri
1. **n8n Model Yönetimi:** Model isimlerini n8n düğümleri içine statik yazmak yerine, global değişkenler üzerinden (`{{ $vars.openai_chat_model }}`, `{{ $vars.openai_dalle_model }}`) yönetmek, model güncellemelerini tek bir noktadan yapmayı sağlayacaktır.
2. **Centralized Error Handling:** n8n üzerinde her iş akışına tek tek hata yönetim düğümü eklemek yerine, n8n'in yerleşik "Error Workflow" özelliğini kullanarak tüm hataları merkezi bir iş akışında toplamak ve Supabase'e yazmak mimariyi sadeleştirecektir.
3. **Idempotency & Replay Koruma Penceresi:** `trigger-brief` edge function'ındaki 5 dakikalık zaman toleransı (replay attack koruması), sunucu saatlerindeki çok küçük sapmalarda (NTP drifts) senkronizasyon hatalarına yol açabilir. Bu sürenin 10-15 dakika gibi daha esnek bir pencereye çekilmesi önerilir.
