# VitrinOS - Canlıya Geçiş Planı

Bu plan, VitrinOS platformunun canlı ortama (production) sorunsuz ve güvenli bir şekilde alınabilmesi için atılması gereken adımları öncelik sırasına göre teknik adımlarla listelemektedir.

---

## 1. Öncelik 1 (Kritik - Canlıya Çıkış Öncesi Yapılması Şart Olanlar)

### 1.1. n8n OpenAI Model Adlarının Düzeltilmesi
- **Etkilenen Servis:** n8n İş Akışları (`VitrinOS_BASE`, `VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_META_POST`, `VitrinOS_REVIZE`)
- **Teknik Adımlar:**
  1. n8n arayüzünden `VitrinOS_BASE` iş akışını açın. `OpenAI_Dil_Modeli` düğümünü bulun ve model adını `gpt-5.4-mini` yerine güncel ve resmi **`gpt-4o-mini`** olarak değiştirin.
  2. `VitrinOS_STORY`, `VitrinOS_BANNER` ve `VitrinOS_META_POST` iş akışlarındaki OpenAI Chat / Prompt model düğümlerini (`OpenAI_Prompt_Modeli`, `OpenAI Chat Model` vb.) bulun ve model adlarını `gpt-5-nano` yerine **`gpt-4o-mini`** veya **`gpt-4o`** olarak güncelleyin.
  3. Tüm alt akışlardaki OpenAI DALL-E model düğümlerini (`GPT_Gorsel_Uret`, `GPT_Urun_Arkaplan_Edit`, `GPT_Arkaplan_Uret`, `OpenAI_Gorseli_Revize_Et`) bulun ve model adlarını `gpt-image-2` yerine güncel ve resmi **`dall-e-3`** (veya ihtiyaç halinde DALL-E 2 edit özellikleri için `dall-e-2`) olarak güncelleyin.
  4. Değişiklikleri kaydedip iş akışlarını yayına (active) alın.
- **Doğrulama Yöntemi:** Manuel test briefi tetikleyin. n8n executions panelinden OpenAI düğümlerinin hata almadan başarıyla sonuçlandığını doğrulayın.
- **Geri Alma / Risk Notu:** OpenAI API fiyatlandırması ve istek limitleri (Rate Limits) doğrultusunda maliyet/hız analizini takip edin.

### 1.2. n8n Hata Yönetimi `jobId` / Boş UUID Hatasının Giderilmesi
- **Etkilenen Servis:** n8n İş Akışı (`VitrinOS_BASE` -> `Hata_Bilgilerini_Hazirla` düğümü)
- **Teknik Adımlar:**
  1. `VitrinOS_BASE` iş akışında `Hata_Bilgilerini_Hazirla` Code düğümünü düzenleyin.
  2. JavaScript kodundaki `jobId` çıkarma mantığını, hata n8n webhook API tetiklenmeden önce veya imza kontrolü sırasında oluşsa dahi (`API_Guvenlik_Filtresi` aşaması), gelen ham webhook body'sinden güvenli şekilde çekecek şekilde güncelleyin:
     ```javascript
     const executionData = $input.first().json;
     const errorMsg = executionData.data?.resultData?.error?.message || "Bilinmeyen Hata";
     let jobId = "";
     
     // Ham webhook isteği veya n8n API verisinden jobId'yi bulmaya çalış
     try {
       const runData = executionData.data.resultData.runData;
       jobId = runData.Brief_Tetikleyici[0].data.main[0][0].json.body.jobId;
     } catch (e) {
       try {
         jobId = $('Brief_Tetikleyici').first().json.body.jobId;
       } catch (err) {
         jobId = null;
       }
     }
     
     // Supabase UUID hatası almamak için jobId null ise hata fırlat veya akışı sonlandır
     if (!jobId) {
       throw new Error("Kritik Hata: jobId bulunamadı. Veritabanı durumu güncellenemiyor. Detay: " + errorMsg);
     }
     
     return [{ json: { jobId, error: errorMsg } }];
     ```
  3. `Supabase_Hata_Yaz` düğümünden önce bir "IF" veya "Filter" düğümü ekleyerek `jobId` değerinin geçerli bir UUID formatında olup olmadığını doğrulayın.
- **Doğrulama Yöntemi:** Geçersiz bir HMAC imzası veya eksik parametre ile webhook'a istek gönderin. n8n'in Supabase tarafında boş UUID hatası vermeden merkezi hata loglarına hatayı düştüğünü doğrulayın.

### 1.3. n8n Webhook Erişim Sıkılaştırması ve Çevre Değişkenleri
- **Etkilenen Servis:** n8n Sunucusu & `VitrinOS_BASE` Webhook
- **Teknik Adımlar:**
  1. n8n sunucusunda `N8N_API_SALT` veya `HMAC_SECRET` çevre değişkenlerinin tanımlandığından ve `trigger-brief` Edge Function'ındaki değer ile birebir eşleştiğinden emin olun.
  2. n8n webhook tetikleyicisinde (`Brief_Tetikleyici`) Header Auth özelliğini aktif ederek `x-vitrinos-webhook-secret` başlığını doğrulayın.
  3. Webhook'un doğrudan internetten spam tetiklenmesini önlemek için, n8n üzerinde veya sunucu firewall/reverse proxy (Nginx, Cloudflare) seviyesinde sadece Supabase Edge Function IP aralıklarından veya belirli bir Gateway IP'sinden gelen isteklere izin verin.
- **Doğrulama Yöntemi:** Edge Function dışındaki harici bir istemciden (örn: Postman) doğrudan n8n webhook URL'sine POST isteği atın. Yetkisiz isteklerin n8n'de execution başlatılmadan doğrudan 401 Unauthorized / 403 Forbidden ile engellendiğini doğrulayın.

### 1.4. Supabase Storage Bucket Koruması ve Signed URL Entegrasyonu
- **Etkilenen Servis:** Supabase Storage (`generated-assets` bucket'ı) & Frontend ([js/supabase.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/supabase.js))
- **Teknik Adımlar:**
  1. Canlı Supabase panelinden Storage sekmesine gidin.
  2. `generated-assets` bucket ayarlarını düzenleyin ve bucket'ı **Private** (`public = false`) yapın.
  3. Frontend tarafında `js/supabase.js` içindeki `getGeneratedAssetUrl` fonksiyonunun (Signed URL üreten) tüm resim yüklemelerinde ve görüntülemelerinde (`dashboard.js` ve `admin.js` dosyalarında) aktif olarak çağrıldığını doğrulayın.
- **Doğrulama Yöntemi:** Üretilen bir görselin ham Supabase Storage URL'sini kopyalayın ve gizli sekmede açın. "Access Denied" hatası aldığınızı, ancak dashboard üzerinde imzalı URL ile görselin sorunsuz görüntülendiğini doğrulayın.

---

## 2. Öncelik 2 (Orta - SaaS Ticarileştirme ve İzleme)

### 2.1. Abonelik, Kredi ve Limit Sisteminin Kurulması
- **Etkilenen Servis:** Supabase Veritabanı (`public.brands` tablosu), Stripe API & Webhook, Frontend Arayüzü
- **Teknik Adımlar:**
  1. `public.brands` tablosuna `monthly_credit_limit` (integer, default 50) ve `used_credits` (integer, default 0) kolonlarını ekleyin.
  2. `trigger-brief` edge function'ına veya Supabase veritabanında `jobs` tablosu üzerinde çalışacak bir trigger fonksiyonuna, her yeni görsel üretim talebinde kullanıcının/markanın kalan kredisini kontrol eden ve yeterli kredi yoksa isteği engelleyen bir validasyon ekleyin.
  3. Stripe ile entegrasyon kurarak kullanıcıların abonelik paketlerine göre kredilerini güncelleyen bir Stripe Webhook Edge Function'ı (`stripe-webhook`) yazın. Bu fonksiyon, ödeme başarılı olduğunda ilgili markanın `monthly_credit_limit` ve `used_credits` alanlarını güncelleyecektir.
  4. Müşteri panelinde (`dashboard.html`) markanın kalan kredi durumunu gösteren bir progress bar / metric card bileşeni ekleyin.
- **Doğrulama Yöntemi:** Kredisi 0 olan bir markayla brief göndermeyi deneyin. Arayüzde "Krediniz yetersiz, lütfen paketinizi yükseltin" uyarısı aldığınızı ve n8n'e istek gitmediğini doğrulayın.

### 2.2. Kullanıcı Kayıt (Sign-up) Ekranının Eklenmesi
- **Etkilenen Dosyalar:** [NEW] `signup.html`, `js/signup.js`, Supabase Auth Yapılandırması
- **Teknik Adımlar:**
  1. Kullanıcıların kendi hesaplarını oluşturabileceği, şifre gücü kontrolü içeren modern bir `signup.html` ve buna bağlı `js/signup.js` dosyası oluşturun.
  2. Supabase Auth ayarlarında self-signup özelliğini aktif edin.
  3. Yeni kullanıcı kaydolduğunda tetiklenecek olan `handle_auth_user_change` trigger fonksiyonunu kontrol ederek, yeni kullanıcının profile kaydının `public.users` tablosuna hatasız düştüğünden emin olun.
  4. Kayıt olan kullanıcıyı doğrudan onboarding / marka oluşturma adımına yönlendirin.
- **Doğrulama Yöntemi:** Yeni bir e-posta ile kayıt olun. E-posta onayından sonra dashboard'a yönlendirildiğinizi ve `public.users` tablosuna ilgili satırın eklendiğini doğrulayın.

### 2.3. Hata İzleme (Sentry) ve n8n Slack/Email Bildirimleri
- **Etkilenen Servis:** Frontend (Sentry SDK), n8n İş Akışları
- **Teknik Adımlar:**
  1. Frontend sayfalarına (`dashboard.html`, `admin.html`) Sentry CDN / SDK kodlarını ekleyin ve runtime hatalarını merkezi olarak izleyin.
  2. n8n üzerinde merkezi bir "Hata İş Akışı" (Error Workflow) oluşturun ve tüm iş akışlarının ayarlarına bu hata akışını tanımlayın.
  3. Bu hata akışında, bir düğüm çöktüğünde Slack veya E-posta yoluyla geliştirici ekibine "Workflow Hatası: [Workflow Name] - Hata: [Error Message]" detayını içeren anlık bildirimler gönderen Slack Webhook / Gmail node entegrasyonu kurun.
- **Doğrulama Yöntemi:** n8n üzerinde yapay bir hata tetikleyin. Slack kanalınıza hata bildiriminin ve detaylı execution linkinin düştüğünü doğrulayın.

---

## 3. Öncelik 3 (Düşük - Lansman Sonrası Adımlar)

### 3.1. SEO, Domain/SSL ve CDN Yapılandırması
- **Etkilenen Servis:** DNS, Cloudflare, index.html Meta Tags
- **Teknik Adımlar:**
  1. Projeyi özel bir domaine (örn: `https://vitrinos.com`) yönlendirin ve Cloudflare üzerinden SSL ile koruyun.
  2. `index.html` üzerinde Open Graph (OG) meta etiketlerini (başlık, açıklama, kapak görseli) güncelleyerek sosyal mecralarda paylaşılabilirliği artırın.
  3. Statik varlıklar (resimler, kütüphaneler) için CDN önbellekleme kuralları belirleyin.

### 3.2. Otomatik Veritabanı Yedeklemeleri
- **Etkilenen Servis:** Supabase Projesi
- **Teknik Adımlar:**
  1. Supabase Pro kontrol panelinden günlük otomatik yedeklemeleri (Backups) aktif edin.
  2. Felaket kurtarma senaryoları için yedeklerin harici bir AWS S3 bucket'ına veya lokal güvenli bir ortama haftalık olarak otomatik çekilmesini sağlayan bir script/akış kurgulayın.
