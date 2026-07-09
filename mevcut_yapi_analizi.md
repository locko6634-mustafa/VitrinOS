# VitrinOS - Mevcut Yapı Analiz Raporu

Bu Rapor, VitrinOS (Yapay Zeka Destekli Görsel Otomasyon Platformu) projesinin yerel kod tabanı (HTML, CSS, JS, SQL migration), canlı Supabase backend yapılandırması ve n8n orkestrasyon iş akışları üzerinde gerçekleştirilen dinamik keşif, kod incelemesi ve siber güvenlik denetimi sonucunda güncellenmiştir.

---

## 1. Kapsam ve Kullanılan Keşif Yöntemleri
Analiz sürecinde aşağıdaki dinamik keşif ve doğrulama yöntemleri kullanılmıştır:
- **Yerel Kod Taraması:** Proje dizinindeki tüm HTML, CSS, JavaScript ve PostgreSQL migration dosyaları taranmış, veri akışı ve istemci yapılandırmaları incelenmiştir.
- **Canlı Supabase Envanter Kontrolü:** `supabase` MCP sunucusu aracılığıyla canlı veritabanı şeması, etkin Row Level Security (RLS) politikaları, veritabanı tetikleyicileri ve Edge Function durumları sorgulanmıştır.
- **n8n İş Akışı Analizi:** `n8n-mcp` aracı kullanılarak sunucudaki 5 aktif iş akışının (`VitrinOS_BASE`, `VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_META_POST`, `VitrinOS_REVIZE`) JSON tanımları, düğüm yapıları, model seçimleri ve veri dönüştürme kodları çıkarılmıştır.

---

## 2. Mimari Özet
VitrinOS sistemi, istemci-sunucu-orkestrasyon üçgeninde modüler ve gevşek bağlı (loosely coupled) bir mimariye sahiptir:

- **Frontend (Vanilla HTML/CSS/JS):** `index.html` (Landing page), `login.html` (Giriş ekranı), `dashboard.html` (Müşteri paneli) ve `admin.html` (Yönetici paneli) sayfalarından oluşur. Supabase JS SDK ([js/supabase.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/supabase.js)) kullanılarak doğrudan veritabanı okuma işlemleri ve realtime abonelikleri yönetilir.
- **Supabase Backend:** `brands`, `brand_prompts`, `jobs`, `leads`, `users` ve `lead_submission_attempts` tablolarından oluşur. RLS politikaları ile korunmaktadır. Edge Function'lar (`submit-lead`, `trigger-brief` vb.) hassas orkestrasyon ve dış sistem entegrasyonu görevlerini üstlenir.
- **n8n Orkestrasyon Akışı:** Görsel üretim brieflerini normalize eden, uygun formata (Story, Banner, Meta Post, Revize) yönlendiren ve OpenAI modelleri ile Jimp görsel işleme kütüphanesini kullanarak son görseli üreten 5 adet aktif iş akışından oluşur.
- **Storage:** Üretilen görseller private `generated-assets` bucket'ı altında saklanır ve istemcilere imzalı URL'ler (`signed URLs`) ile güvenli şekilde dağıtılır.

---

## 3. İyi Çalışan ve Başarılı Tasarlanmış Alanlar
Projede güvenlik, performans ve mimari açıdan doğru kurgulanmış başlıca alanlar şunlardır:

1. **Güvenli Storage Tasarımı:** `generated-assets` bucket'ı canlı ortamda private (`public = false`) olarak yapılandırılmıştır. [js/supabase.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/supabase.js#L123-L146) istemci tarafında imzalı URL'leri önbelleğe (cache) alarak gereksiz API çağrılarını önlerken, RLS politikaları ile kullanıcıların yalnızca kendi markalarına ait görsel metadatalarını görebilmeleri garanti altına alınmıştır.
2. **Kısıtlı Client-Side Güncellemeleri:** Kullanıcıların `jobs` tablosunda doğrudan UPDATE yapma yetkisi tamamen kaldırılmış (`revoke update`), güncellemeler yalnızca `service_role` kullanan Edge Function'lar veya RPC'ler (`apply_job_revision_request` vb.) üzerinden güvenli kontrol noktalarından geçerek yapılmaktadır.
3. **JWT Tabanlı Edge Function Güvenliği:** `trigger-brief` Edge Function'ında istemciden JWT talep edilerek RLS kuralları işletilmekte ve yetkisiz kullanıcıların başkalarına ait işleri tetiklemesi engellenmektedir.
4. **İmzalı Webhook Güvenliği (HMAC):** Edge Function ile n8n `VitrinOS_BASE` webhook'u arasındaki iletişim SHA-256 HMAC imzası (`x-vitrinos-signature`) ve zaman damgası (`x-vitrinos-timestamp`) ile korunmaktadır. Bu sayede n8n webhook URL'si dış dünyaya doğrudan açık olsa bile doğrulanmamış istekler reddedilir.
5. **Gelişmiş Lead Formu Güvenliği:** `submit-lead` Edge Function'ında honeypot (companyFax), form doldurma süresi (min 3 sn), IP/E-posta bazlı saatlik/günlük rate limit ve parmak izi bazlı mükerrer başvuru (duplicate) korumaları aktif edilmiştir. Son CORS güncellemesiyle, `LEAD_ALLOWED_ORIGINS` boş bırakıldığında tüm dış kaynaklar varsayılan olarak engellenmektedir.
6. **Verimli Realtime Abonelikleri:** [js/dashboard.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/dashboard.js#L915-L934) üzerinde `user_id` filtresi kullanılarak yalnızca mevcut kullanıcıya ait işlerin anlık değişimleri dinlenmekte, veritabanı ve istemci kaynakları optimum düzeyde kullanılmaktadır.
7. **Veritabanı İndeks Optimizasyonu:** `20260710004500_add_optimize_jobs_indexes.sql` migration dosyası ile `jobs` tablosunun `created_at` ve `status` alanları üzerinde optimize edilmiş kombine indeks oluşturularak dashboard yüklenme süreleri optimize edilmiştir.
8. **Güvenli Davet ve RPC Yapısı:** `20260708153000_remove_default_password_and_document_exceptions.sql` ile sabit şifre (`Vitrinos123!`) kaldırılmış ve 12 karakterli rastgele geçici şifre üretimine geçilmiştir. SECURITY DEFINER fonksiyonlarına veritabanı seviyesinde bilinçli istisna yorumları (linter exceptions) eklenerek güvenlik sıkılaştırılmıştır.

---

## 4. Kritik Riskler (P0)

### 4.1. n8n OpenAI Geçersiz Model Adları Uyumsuzluğu
- **Bulgu:** n8n iş akışlarında kullanılan model isimleri resmi olarak mevcut olmayan veya yanlış yazılmış değerlere sahiptir:
  - `VitrinOS_BASE` iş akışındaki `OpenAI_Dil_Modeli` düğümününde model adı **`gpt-5.4-mini`** olarak ayarlanmıştır.
  - `VitrinOS_STORY`, `VitrinOS_BANNER` ve `VitrinOS_META_POST` iş akışlarındaki OpenAI Chat/Prompt model düğümlerinde model adı **`gpt-5-nano`** olarak ayarlanmıştır.
  - Tüm bu alt akışlardaki OpenAI DALL-E görsel üretim/düzenleme düğümlerinde model adı **`gpt-image-2`** olarak seçilmiştir.
- **Etki:** OpenAI API'si bu geçersiz model adlarını reddedecek ve "Model not found" hatası fırlatarak tüm görsel üretim akışlarının anında başarısız olmasına sebep olacaktır. Canlıda sistemin çalışması için bu modellerin `gpt-4o-mini`, `gpt-4o` ve `dall-e-3` (veya `dall-e-2`) olarak güncellenmesi şarttır.

### 4.2. n8n Hata Yönetiminde Boş UUID ve Supabase Yazma Hatası
- **Bulgu:** `VitrinOS_BASE` iş akışındaki `Hata_Bilgilerini_Hazirla` Code düğümü, webhook gövdesinden `jobId` parametresini çekmeye çalışmaktadır. Eğer hata n8n webhook API tetiklenmeden önce (örn: imza doğrulaması aşamasında) veya geçersiz bir veriyle oluşursa `jobId` değeri boş kalmakta (`jobId = ""`) ve `Supabase_Hata_Yaz` düğümüne iletilmektedir.
- **Etki:** Supabase PostgreSQL veritabanı, boş stringi UUID tipine çeviremediği için "invalid input syntax for type uuid" hatası fırlatacak ve asıl hata loglanamayacaktır. Job durumu `failed` olarak güncellenemeyeceğinden, dashboard'da işlem sürekli `processing` durumunda asılı kalacaktır.

---

## 5. Orta Riskler (P1)

### 5.1. Jimp Bağımlılığı ve n8n Ortam Hata Toleransı
- **Bulgu:** n8n alt akışlarındaki JavaScript Code düğümlerinde görsel dikey Story veya Banner formatına dönüştürülürken ve logo yerleştirilirken `require('jimp')` kullanılmaktadır.
- **Etki:** n8n sunucusunda `NODE_FUNCTION_ALLOW_EXTERNAL=jimp` çevre değişkeni tanımlanmamışsa veya sunucu ortamında `jimp` kütüphanesi kurulu değilse bu düğümler çökecektir. Ayrıca logo indirme (`Jimp.read(logo_url)`) işlemlerinde ağ hatası oluşursa tüm workflow catch mekanizması olmadan çökecektir.

### 5.2. n8n API İstek Kirliliği (Spam Tetikleme Riski)
- **Bulgu:** Her ne kadar `API_Guvenlik_Filtresi` imza doğrulaması yapsa da, bu filtre n8n iş akışının ilk düğümü olan Webhook'tan sonra çalışmaktadır. Dışarıdan doğrudan atılan geçersiz ve imzasız istekler n8n üzerinde execution (çalıştırma) başlatmakta ve filtrede elenmektedir.
- **Etki:** Kötü niyetli kişilerin webhook URL'sini doğrudan spam etmesi durumunda n8n sunucusu üzerinde çok sayıda başarısız execution logu birikecek ve sunucu kaynakları tükenerek hizmet dışı kalabilecektir (DDoS riski).

---

## 6. Düşük Riskler (P2)

### 6.1. Veritabanı İndekslerinin SaaS İş Hacmine Uyarlanması
- **Bulgu:** `jobs` tablosundaki `created_at` ve `status` alanları üzerine kombine indeksler eklenmiştir. Ancak ticarileşme aşamasında (SaaS) marka bazlı faturalandırma ve kredi limiti takibi yapılacağından, `brands(user_id)` ve `jobs(brand_id, status)` alanlarının ilişkisel sorguları daha sık kullanılacaktır.
- **Etki:** İş hacmi çok yüksek seviyelere ulaştığında (örn. milyonlarca iş kaydı), tekil veritabanı sorguları ve kredi limiti kontrolleri yavaşlayabilir.

---

## 7. Mimari İyileştirme Önerileri
1. **n8n Model Yönetimi:** Model isimlerini n8n düğümleri içine statik yazmak yerine, global değişkenler üzerinden (`{{ $vars.openai_chat_model }}`, `{{ $vars.openai_dalle_model }}`) yönetmek, model güncellemelerini tek bir noktadan yapmayı sağlayacaktır.
2. **Centralized Error Handling:** n8n üzerinde her iş akışına tek tek hata yönetim düğümü eklemek yerine, n8n'in yerleşik "Error Workflow" özelliğini kullanarak tüm hataları merkezi bir iş akışında toplamak ve Supabase'e yazmak mimariyi sadeleştirecektir.
3. **Idempotency & Replay Koruma Penceresi:** `trigger-brief` edge function'ındaki 5 dakikalık zaman toleransı (replay attack koruması), sunucu saatlerindeki çok küçük sapmalarda (NTP drifts) senkronizasyon hatalarına yol açabilir. Bu sürenin 10-15 dakika gibi daha esnek bir pencereye çekilmesi önerilir.
4. **Veritabanı RPC Güvenliği:** RPC fonksiyonlarının (`apply_job_revision_request` vb.) `SECURITY DEFINER` yetkisiyle çalışması doğrudur ancak execute izinlerinin public'ten kaldırılıp sadece `service_role`'a verilmiş olması disiplini sürdürülmelidir.
