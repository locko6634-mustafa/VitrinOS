# VitrinOS - Mevcut Yapı Analiz Raporu

Bu rapor, VitrinOS projesinin yerel kod tabanı, Supabase backend mimarisi ve n8n otomasyon iş akışları üzerinde gerçekleştirilen dinamik keşif ve detaylı analiz çalışmalarının sonuçlarını içermektedir.

---

## 1. Kapsam ve Kullanılan Keşif Yöntemleri
Analiz süreci, varsayımlardan kaçınarak canlı sistemler ve yerel kod dosyalarının doğrudan incelenmesiyle gerçekleştirilmiştir:
*   **Yerel Kod Tabanı:** `c:\Users\Mustafa\Desktop\VitrinOS` dizinindeki HTML, JS, CSS dosyaları ve `supabase/migrations/` altındaki SQL şemaları taranmış, kod içi referanslar ve veri akışları analiz edilmiştir.
*   **Supabase Backend:** `wrzalebhnlwppufdcmiz` referanslı canlı Supabase projesinde tablolar, RLS politikaları, RPC fonksiyonları, storage bucket ayarları ve Advisors logları sorgulanmıştır.
*   **n8n Otomasyonu:** Canlı n8n sunucusundaki `VitrinOS_` ön ekiyle başlayan tüm iş akışlarının düğüm (node) yapılandırmaları, değişken atamaları ve API parametreleri incelenmiştir.

---

## 2. Mimari Özet
VitrinOS, modern bulut servisleri ile hafif bir istemci mimarisini entegre eden dinamik bir yapıya sahiptir:
*   **Frontend (İstemci):** CDN üzerinden yüklenen Supabase SDK'sı yardımıyla doğrudan veritabanı ve auth servislerine bağlanan, Vanilla HTML/CSS/JS tabanlı tek sayfa veya çoklu sayfa akışıdır.
*   **Supabase (Veritabanı & Backend):** Postgres 17 üzerinde kurulu, katı RLS (Row Level Security) kuralları ve SQL tabanlı güvenli RPC (Remote Procedure Call) fonksiyonları ile donatılmış veri katmanıdır. 
*   **Supabase Edge Functions:** Frontend'in n8n webhook'larını güvenli bir şekilde tetiklemesini sağlayan ve token doğrulamasını gerçekleştiren ara katmandır (`trigger-brief` ve `submit-lead`).
*   **n8n (Orkestrasyon & AI):** Webhook tetiklemeleriyle çalışan, OpenAI (GPT ve DALL-E) entegrasyonlarını yürüten, Jimp ile görselleri işleyen ve sonuçları Supabase Storage'a geri yükleyen ana otomasyon motorudur.
*   **Storage (Depolama):** Üretilen pazarlama görsellerinin saklandığı, doğrudan erişime kapalı (Private) ve kullanıcı tabanlı RLS ile korunan `generated-assets` storage bucket'ıdır.

---

## 3. İyi Çalışan Yerler
*   **Güçlü SQL Güvenlik Mimarisi:** Kullanıcıların `jobs` tablosundaki durumları doğrudan güncellemesi engellenmiş (`revoke update...`), güncellemeler `SECURITY DEFINER` RPC fonksiyonları (`approve_job`, `request_job_revision`) ile sınırlandırılmıştır.
*   **Güvenli n8n Tetikleme Mekanizması:** Frontend'de açık n8n URL'si bulunmamaktadır. Akış Supabase Edge Function (`trigger-brief`) üzerinden başlatılmakta ve `x-vitrinos-webhook-secret` başlığıyla n8n webhook güvenliği sağlanmaktadır.
*   **Storage Güvenliği:** `generated-assets` bucket'ı private olarak ayarlanmış ve kullanıcıların sadece kendi işlerine (job) ait görselleri okuyup yazabileceği sıkı nesne bazlı RLS politikaları tanımlanmıştır.
*   **Lead Form Güvenliği:** `submit-lead` fonksiyonu üzerinde honeypot kontrolü, IP ve E-posta bazlı rate-limit'ler ve mükerrer başvuru engellemesi (7 gün) oldukça başarılı çalışmaktadır.
*   **Migration Tutarlılığı:** Canlı veritabanı ile yerel migration dosyaları arasında herhangi bir drift (fark) bulunmamaktadır. Tüm migration'lar canlıda uygulanmıştır.

---

## 4. Kritik Riskler (P0)

### 4.1. Hata Durumlarında Asılı Kalan İşler (Jobs Status 'processing' Hatası)
*   **Kanıt:** n8n İş Akışları (Tüm akışlar: `VitrinOS_BASE`, `VitrinOS_META_POST` vb.)
*   **Açıklama:** İş akışındaki OpenAI rate-limit aşımı, Jimp çökmesi, resim indirme hatası veya Supabase bağlantı kesintilerinde hata yönetimi (Error Branch / On Error: Continue) tanımlanmamıştır.
*   **Risk:** Herhangi bir adımda hata oluştuğunda, n8n iş akışı durur fakat veritabanındaki `jobs.status` alanı sonsuza dek `'processing'` durumunda kalır. Dashboard ekranında bu iş sürekli yükleniyor olarak asılı kalır ve kullanıcı hata çıktısını göremez.

### 4.2. Geçersiz OpenAI Model İsimleri
*   **Kanıt:** `VitrinOS_BASE` (`LLM_Brief_Analiz_Ajani` -> `gpt-5.4-mini`), Alt Akışlar (`OpenAI_Dil_Modeli` -> `gpt-5-nano`), Görsel Akışları (`gpt-image-2`)
*   **Açıklama:** OpenAI API'lerinde resmi olarak bu isimde modeller bulunmamaktadır.
*   **Risk:** Eğer n8n ile OpenAI arasında bir model eşleştirme proxy'si (LiteLLM vb.) kullanılmıyorsa, doğrudan API çağrıları `404 Invalid Model` veya `400 Bad Request` ile çökecektir. Canlı sisteme çıkmadan önce bu model isimlerinin resmi modellerle (örn. `gpt-4o-mini`, `dall-e-3`) güncellenmesi gerekir.

### 4.3. Jimp Görsel İşleme ve Güvenlik Açıkları (SSRF & Çökme Riski)
*   **Kanıt:** n8n Code Düğümleri (`Meta_Post_Yeniden_Boyutlandır`, `Story_Yeniden_Boyutlandır` vb. - `const { Jimp } = require('jimp');`)
*   **Açıklama:**
    1.  `Jimp.read(brand.logo_url)` ifadesi doğrudan logo URL'sini indirir. Logo URL'si boş, null veya hatalıysa düğüm istisna fırlatıp çöker.
    2.  Kullanıcının girdiği kontrolsüz logo URL'sinin sunucu tarafından indirilmesi SSRF (Server-Side Request Forgery) açığı oluşturur.
    3.  Binary verilerin okunmasında hiçbir MIME type veya dosya boyutu kontrolü yoktur; PNG/JPEG dışındaki dosyalarda Jimp patlar.

---

## 5. Orta Riskler (P1)

### 5.1. n8n Expression Sözdizimi ve Input Hataları
*   **Kanıt:** `VitrinOS_BASE` -> `Call_VitrinOS_REVIZE` Execute Workflow girdileri
*   **Açıklama:**
    *   Tetikleme parametrelerinin sonunda boşluklar bırakılmıştır: `"revision_text "` ve `"original_brief "`.
    *   `Baslangic_Verilerini_Ayarla` içinde değişken isimlerinde boşluklar kullanılmıştır: `revizyon mesaj`, `orjinal brief`.
    *   IF düğümünde eski syntax (`$node['...']`) tercih edilmiştir.
*   **Risk:** Geliştirme sürecinde parametre eşleşme hatalarına ve veri kayıplarına yol açabilir.

### 5.2. Admin Davet Kodu Şifre Çelişkisi ve Arayüz Hatası
*   **Kanıt:** `js/admin.js` L804 ve `20260708153000_remove_default_password_and_document_exceptions.sql` L32
*   **Açıklama:** Veritabanında yapılan son güncelleme ile admin davet şifresi (`Vitrinos123!`) kaldırılarak rastgele geçici şifre üretimi aktifleştirilmiştir. Ancak `js/admin.js` dosyasında kullanıcı onaylandığında hâlâ `alert("Başvuru onaylandı (Varsayılan şifre: Vitrinos123!)")` statik mesajı verilmektedir.
*   **Risk:** Admin kullanıcıya yanlış şifre bilgisi aktaracak, davet edilen kullanıcı ise rastgele şifre atandığı için sisteme giriş yapamayacaktır.

### 5.3. Webhook Tetikleme Güvenliği Eksikliği
*   **Kanıt:** `VitrinOS_BASE` -> `Brief_Tetikleyici` Webhook Düğümü
*   **Açıklama:** Tetikleyici istekte payload doğruluğunu denetleyecek bir HMAC imza doğrulaması veya replay saldırılarını önleyecek timestamp/nonce denetimi bulunmamaktadır.
*   **Risk:** `x-vitrinos-webhook-secret` sızdırıldığında n8n üzerinde yetkisiz görsel üretim tetiklemeleri yapılarak API maliyetleri artırılabilir.

---

## 6. Düşük Riskler (P2)

### 6.1. Türkçe Karakter Encoding Bozulması
*   **Kanıt:** `js/admin.js` L94
*   **Açıklama:** Hata loglama satırında Türkçe karakter bozulması mevcuttur: `console.error("GÃ¶rsel signed URL hatasÄ±:", assetErr);`.
*   **Risk:** Log okunabilirliğini düşürür.

### 6.2. Arayüz ve Kod Davranışı Çelişkisi (Demo Uyarıları)
*   **Kanıt:** `dashboard.html` (L36-38, L191-199) ve `admin.html` (L41-42)
*   **Açıklama:** Arayüzdeki statik yazılarda uygulamanın demo olduğu ve gerçek veri yazmadığı belirtilmiştir. Ancak JS kodları canlı Supabase'e bağlıdır ve veri kaydetmektedir.
*   **Risk:** Kullanıcılarda kafa karışıklığı yaratır.

### 6.3. Supabase Advisor Uyarıları
*   **Kanıt:** Supabase Advisors Logları (Unused Index & Leaked Password Check)
*   **Açıklama:** `brands_user_id_idx`, `jobs_user_id_idx` gibi indeksler henüz az veri olduğu için kullanılmamaktadır. HaveIBeenPwned entegrasyonu kapalıdır.
*   **Risk:** Güvenlik ve veri büyümesine bağlı performans eksiklikleri oluşabilir.

---

## 7. Mimari İyileştirme Önerileri
1.  **n8n Global Hata Yönetimi:** n8n üzerinde bir "Error Workflow" tanımlanarak, herhangi bir iş akışı çöktüğünde Supabase'e HTTP isteği gönderilerek ilgili job durumu `'failed'` yapılmalıdır.
2.  **Jimp Güvenlik Sarmalı (Wrapper):** Logo URL'sinin boş olup olmadığı kontrol edilmeli, URL validation uygulanmalı ve Jimp işlemleri `try-catch` blokları içine alınmalıdır.
3.  **Model Standardizasyonu:** Düğüm düzeyinde resmi modeller (`gpt-4o-mini`, `dall-e-3`) atanmalı, geçersiz proxy isimleri temizlenmelidir.
4.  **Admin Arayüz Eşitlemesi:** `js/admin.js` üzerinde statik alert mesajı kaldırılarak veritabanından dönen `temporary_password` alanı ekrana basılmalıdır.
