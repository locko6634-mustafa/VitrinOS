# VitrinOS - Canlıya Geçiş Planı

Bu plan, VitrinOS platformunun canlı ortama (production) sorunsuz ve güvenli bir şekilde alınabilmesi için atılması gereken adımları öncelik sırasına göre teknik adımlarla listelemektedir.

---

## 1. P0: Canlıya Çıkmadan Önce Zorunlu Güvenlik ve Doğruluk İşleri

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
       // Alternatif 1: n8n API runData üzerinden
       const runData = executionData.data.resultData.runData;
       jobId = runData.Brief_Tetikleyici[0].data.main[0][0].json.body.jobId;
     } catch (e) {
       try {
         // Alternatif 2: Doğrudan tetikleyici girdi verisinden
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
- **Geri Alma / Risk Notu:** Bu değişiklik hata loglamasını kurtaracak ancak `jobId`'nin hiç oluşturulamadığı durumlarda n8n veritabanına yazamayacaktır. Bu durumda n8n execution logları tek kaynak olacaktır.

---

## 2. P1: Güvenilirlik, Gözlemlenebilirlik ve Hata Yönetimi

### 2.1. Veritabanı Migration Driftlerinin Kapatılması
- **Etkilenen Servis:** Supabase PostgreSQL Veritabanı & Yerel Migrations Klasörü
- **Teknik Adımlar:**
  1. Canlı veritabanındaki `apply_job_revision_request` RPC fonksiyonunun tam SQL tanımını dışarı aktarın (dışa aktarılan SQL tanımı mevcut yapı analizinde belgelenmiştir).
  2. Yerel `supabase/migrations/` klasöründe yeni bir migration dosyası oluşturun (örn: `20260709160000_add_apply_job_revision_request.sql`).
  3. RPC fonksiyon tanımını ve gerekli execute izinlerini bu dosyaya yazın:
     ```sql
     -- apply_job_revision_request fonksiyonu
     CREATE OR REPLACE FUNCTION public.apply_job_revision_request(target_job_id uuid, target_user_id uuid, revision_note text)
     RETURNS jobs
     LANGUAGE plpgsql
     SECURITY DEFINER
     SET search_path TO 'public', 'pg_temp'
     AS $$
     -- ... fonksiyon gövdesi ...
     $$;
     
     -- İzinler
     REVOKE EXECUTE ON FUNCTION public.apply_job_revision_request(uuid, uuid, text) FROM public, anon, authenticated;
     GRANT EXECUTE ON FUNCTION public.apply_job_revision_request(uuid, uuid, text) TO service_role;
     ```
- **Doğrulama Yöntemi:** Yerelde boş bir DB üzerine `supabase db reset` komutunu çalıştırarak tüm migration'ların hatasız uygulandığını ve lokalde fonksiyonun oluştuğunu doğrulayın.
- **Geri Alma / Risk Notu:** Canlı veritabanına bu migration dosyasını `supabase db push` ile gönderirken drift oluşmamasına dikkat edilmelidir.

### 2.2. n8n Jimp / Görsel İşleme Hata Toleransının Artırılması
- **Etkilenen Servis:** n8n İş Akışları (`VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_META_POST`)
- **Teknik Adımlar:**
  1. Jimp görsel işleme Code düğümlerini (`Story_Yeniden_Boyutlandır` vb.) try-catch blokları ile sararak daha esnek hale getirin.
  2. Logo URL'sinden resim indirilemediğinde veya Jimp işlenirken bir hata oluştuğunda tüm akışın durması yerine, hata logunu n8n execution context'ine kaydedip görseli logosuz/ham haliyle oluşturup süreci devam ettirecek fallback mekanizması kurun:
     ```javascript
     // Fallback örneği
     let logoImage;
     try {
       logoImage = await Jimp.read(brand.logo_url);
     } catch (logoErr) {
       console.warn("Logo indirilemedi, logosuz devam ediliyor:", logoErr.message);
       logoImage = null;
     }
     if (logoImage) {
       // Logo birleştirme işlemleri...
     }
     ```
- **Doğrulama Yöntemi:** Bir markanın `logo_url` değerine geçersiz veya kırık bir link vererek brief gönderin. Görselin logosuz da olsa başarıyla üretildiğini ve job durumunun `completed` olduğunu doğrulayın.
- **Geri Alma / Risk Notu:** Jimp kütüphanesinin n8n sunucusunda kurulu olduğundan emin olun (`NODE_FUNCTION_ALLOW_EXTERNAL=jimp` env değişkeni).

---

## 3. P2: Kalite, Bakım, Dokümantasyon ve UX İyileştirmeleri

### 3.1. Giriş Ekranı Prefill ve Demo Simülasyonunun Eklenmesi
- **Etkilenen Dosyalar:** [login.html](file:///c:/Users/Mustafa/Desktop/VitrinOS/login.html), [login.js](file:///c:/Users/Mustafa/Desktop/VitrinOS/js/login.js)
- **Teknik Adımlar:**
  1. `login.html` formunun altına veya uygun bir görsel alana "Demo Hesaplar" butonu/badge'i ekleyin. (Örn: "Pilot Girişi" ve "Admin Girişi").
  2. `login.js` dosyasında bu butonlara tıklandığında formdaki `loginEmail` ve `loginPassword` alanlarını otomatik dolduracak (prefill) ve formu tetikleyecek JavaScript fonksiyonlarını ekleyin.
  3. `sessionStorage` veya `localStorage` üzerinde demo oturumu simüle edecek yardımcı auth bayrakları ekleyerek internet kesintilerinde veya lokal testlerde veritabanı olmadan da arayüzün açılmasını sağlayın.
- **Doğrulama Yöntemi:** Tarayıcıda `login.html` sayfasına gidin, "Demo Giriş" butonuna tıklayın, formun dolduğunu ve yönlendirmenin çalıştığını doğrulayın.

### 3.2. submit-lead CORS Origin Sıkılaştırması
- **Etkilenen Dosya:** [submit-lead](file:///c:/Users/Mustafa/Desktop/VitrinOS/supabase/functions/submit-lead/index.ts#L138)
- **Teknik Adımlar:**
  1. Supabase kontrol panelinden Edge Function çevre değişkenlerine (secrets) `LEAD_ALLOWED_ORIGINS` değişkenini ekleyin ve değer olarak projenin canlı frontend domain adını (örn: `https://vitrinos.com`) girin.
  2. Edge function kodunda `LEAD_ALLOWED_ORIGINS` değişkeninin boş olması durumunda anonim tüm isteklere izin vermek yerine, hata fırlatarak istekleri reddeden bir fallback güvenlik duvarı ekleyin:
     ```javascript
     if (!allowedOrigins.length) {
       return json({ ok: false, message: "Security configuration error: Allowed origins are not defined." }, 500);
     }
     ```
- **Doğrulama Yöntemi:** Postman veya farklı bir origin üzerinden `submit-lead` fonksiyonuna doğrudan POST isteği atın ve 403 Forbidden / 500 Server Error hatası aldığınızı doğrulayın.
