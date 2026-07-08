# VitrinOS - Canlıya Geçiş Planı

Bu plan, VitrinOS uygulamasının canlı (production) ortama sorunsuz ve güvenli bir şekilde aktarılabilmesi için yapılması gereken teknik adımları, doğrulama yöntemlerini ve risk analizlerini öncelik sırasına (P0, P1, P2) göre listelemektedir.

---

## P0: Canlıya Çıkmadan Önce Zorunlu Güvenlik ve Doğruluk İşleri

### 1. n8n OpenAI Model İsimlerinin Düzeltilmesi
*   **Etkilenen Servis/Dosya:** n8n İş Akışları (`VitrinOS_BASE`, `VitrinOS_META_POST`, `VitrinOS_STORY`, `VitrinOS_BANNER`, `VitrinOS_REVIZE`)
*   **Teknik Adımlar:**
    1.  `VitrinOS_BASE` iş akışındaki `OpenAI_Dil_Modeli` düğümündeki geçersiz `gpt-5.4-mini` model seçimi **`gpt-4o-mini`** olarak güncellenmelidir.
    2.  Alt akışlardaki (`META_POST`, `STORY`, `BANNER`) `OpenAI_Dil_Modeli` düğümlerinde bulunan geçersiz `gpt-5-nano` modeli **`gpt-4o-mini`** veya **`gpt-4o`** olarak değiştirilmelidir.
    3.  DALL-E görsel üretim/düzenleme düğümlerindeki (`GPT_Arkaplan_Uret`, `GPT_Urun_Arkaplan_Edit`, `GPT_Gorsel_Uret`, `OpenAI_Gorseli_Revize_Et`) geçersiz `gpt-image-2` model ID'si güncel görsel üretim modeli olan **`dall-e-3`** olarak güncellenmelidir.
*   **Doğrulama Yöntemi:** n8n üzerinde manuel bir tetikleme yapılarak OpenAI API'sinden 200 OK yanıtı döndüğü ve görsel/metin üretiminin başarıyla tamamlandığı doğrulanmalıdır.
*   **Geri Alma / Risk Notu:** Model isimleri düzeltilmediğinde, ara bir proxy/gateway katmanı yoksa sistem tamamen 404/400 hatalarıyla çökecektir.

### 2. Admin Davet Şifresi UX Hatasının Düzeltilmesi
*   **Etkilenen Servis/Dosya:** `js/admin.js` (L804) ve `js/admin.js` (L770-810)
*   **Teknik Adımlar:**
    1.  `js/admin.js` dosyasında kullanıcı onaylandığında çıkan statik ve artık geçersiz olan `alert("Başvuru onaylandı (Varsayılan şifre: Vitrinos123!)")` uyarısı kaldırılmalıdır.
    2.  `invite_user` RPC fonksiyonundan dönen `temporary_password` verisi okunarak admin kullanıcısına dinamik olarak gösterilmelidir:
        ```javascript
        const { data, error } = await supabase.rpc('invite_user', { ... });
        if (data && data.temporary_password) {
            alert(`Kullanıcı davet edildi! Geçici Şifre: ${data.temporary_password}`);
        }
        ```
*   **Doğrulama Yöntemi:** Admin panelinden bir lead onaylanarak ekrana gelen alert kutusunda rastgele üretilmiş şifrenin görüntülendiği doğrulanmalıdır.
*   **Geri Alma / Risk Notu:** Düzeltilmezse davet edilen kullanıcılar kendilerine atanan rastgele geçici şifreyi bilemeyecekleri için sisteme giriş yapamayacaktır.

### 3. Jimp SSRF ve Boş URL Çökme Koruması
*   **Etkilenen Servis/Dosya:** n8n Code Düğümleri (`Meta_Post_Yeniden_Boyutlandır`, `Story_Yeniden_Boyutlandır`, `Banner_Yeniden_Boyutlandir`)
*   **Teknik Adımlar:**
    1.  `Jimp.read(brand.logo_url)` çağrısından önce `brand.logo_url` değerinin boş (`null`, `undefined` veya boş string) olup olmadığı kontrol edilmelidir.
    2.  Logo URL'si geçersiz veya boşsa, Jimp hata fırlatıp tüm iş akışını çökertmek yerine varsayılan bir yedek logo yüklemeli ya da logoyu yerleştirme adımını güvenli bir şekilde bypass etmelidir.
    3.  Tüm görsel işleme mantığı `try-catch` blokları içine alınarak n8n hata fırlatması engellenmelidir.
*   **Doğrulama Yöntemi:** Logosu olmayan (`logo_url` alanı boş olan) yeni bir marka oluşturularak brief tetiklenmeli ve n8n akışının çökmeden görsel ürettiği doğrulanmalıdır.
*   **Geri Alma / Risk Notu:** Bu koruma sağlanmazsa, logo yüklemeyen veya geçersiz URL giren her kullanıcı için sistem duracaktır.

---

## P1: Güvenilirlik, Gözlemlenebilirlik ve Hata Yönetimi

### 1. n8n Global Hata Yönetimi (Jobs Tablosu Senkronizasyonu)
*   **Etkilenen Servis/Dosya:** n8n İş Akışları (`VitrinOS_BASE` vb.) ve Supabase `jobs` tablosu.
*   **Teknik Adımlar:**
    1.  n8n üzerinde global bir **Error Workflow** tanımlanmalıdır.
    2.  Ana akışta (`VitrinOS_BASE`) veya alt akışlarda herhangi bir düğüm hata verdiğinde bu hata akışı tetiklenmelidir.
    3.  Hata akışı, çöken akışın girdilerinden `jobId` değerini alarak Supabase HTTP/Supabase düğümü üzerinden ilgili job kaydının durumunu `'failed'` olarak güncellemelidir.
*   **Doğrulama Yöntemi:** n8n'deki bir düğüm kasıtlı olarak bozularak (örn. API anahtarı kaldırılarak) brief tetiklenmeli ve Supabase `jobs` tablosundaki durumun anında `'failed'` değerine dönüştüğü izlenmelidir.
*   **Geri Alma / Risk Notu:** Bu yapılmazsa, çöken her işlemde veritabanındaki status sonsuza kadar `'processing'` kalır ve kullanıcı dashboard'u donar.

### 2. n8n Parametre Boşluklarının (Trailing Spaces) Temizlenmesi
*   **Etkilenen Servis/Dosya:** `VitrinOS_BASE` -> `Call_VitrinOS_REVIZE` Execute Workflow parametreleri.
*   **Teknik Adımlar:**
    1.  Execute Workflow düğümü girdilerindeki `"revision_text "` ve `"original_brief "` parametre isimlerinin sonundaki gereksiz boşluklar silinerek `"revision_text"` ve `"original_brief"` olarak güncellenmelidir.
    2.  `Baslangic_Verilerini_Ayarla` düğümündeki boşluklu değişken isimleri (`revizyon mesaj` -> `revizyon_mesaj`) alt çizgi ile birleştirilmelidir.
*   **Doğrulama Yöntemi:** Revizyon isteği gönderilerek alt akışa parametrelerin kayıpsız aktarıldığı n8n loglarından izlenmelidir.
*   **Geri Alma / Risk Notu:** Sözdizimi hataları n8n güncellemelerinde veri aktarımının durmasına yol açabilir.

### 3. Webhook Güvenliği İçin HMAC İmza Doğrulaması
*   **Etkilenen Servis/Dosya:** Supabase Edge Function (`trigger-brief`) ve n8n Webhook Tetikleyici (`Brief_Tetikleyici`).
*   **Teknik Adımlar:**
    1.  Edge Function, n8n'i tetiklerken payload gövdesini ve bir secret anahtarını kullanarak `HMAC-SHA256` imzası üretmeli ve bunu `x-vitrinos-signature` başlığı altında göndermelidir.
    2.  n8n tarafındaki tetikleyici düğüm veya hemen sonrasındaki bir Code düğümü, gelen imzayı doğrulamalıdır. Ayrıca istek içine eklenen `timestamp` değeri kontrol edilerek replay saldırıları engellenmelidir.
*   **Doğrulama Yöntemi:** İmzasız veya hatalı imzayla n8n webhook URL'sine gönderilen isteklerin n8n tarafından 401 Unauthorized ile reddedildiği doğrulanmalıdır.
*   **Geri Alma / Risk Notu:** İmza doğrulaması n8n tetikleme maliyetlerini kontrol altında tutmak için kritiktir.

---

## P2: Kalite, Bakım, Dokümantasyon ve UX İyileştirmeleri

### 1. Arayüzdeki Demo State Yazılarının Kaldırılması
*   **Etkilenen Servis/Dosya:** `dashboard.html` (L36-38, L191-199) ve `admin.html` (L41-42)
*   **Teknik Adımlar:**
    1.  HTML dosyalarındaki "Bu bir demo sürümüdür, veri yazılmaz, bağlantılar kapalıdır" gibi gerçek dışı ibareler temizlenmelidir.
    2.  Bunun yerine "VitrinOS Canlı Otomasyon Sistemi" veya markaya uygun profesyonel karşılama metinleri yerleştirilmelidir.
*   **Doğrulama Yöntemi:** Sayfa yerel olarak açılıp kontrol edilmelidir.
*   **Geri Alma / Risk Notu:** Düşük risklidir, yalnızca görsel ve UX tutarlılığını sağlar.

### 2. Türkçe Karakter Encoding Hatalarının Giderilmesi
*   **Etkilenen Servis/Dosya:** `js/admin.js` (L94)
*   **Teknik Adımlar:**
    1.  `GÃ¶rsel signed URL hatasÄ±:` ifadesi `Görsel signed URL hatası:` olarak güncellenmelidir.
    2.  Dosya kaydedilirken `UTF-8` encoding formatı ile kaydedildiğinden emin olunmalıdır.
*   **Doğrulama Yöntemi:** Tarayıcı geliştirici konsolunda signed URL hatası oluştuğunda çıktının düzgün Türkçe karakterlerle yazdırıldığı gözlenmelidir.
*   **Geri Alma / Risk Notu:** Kozmetik bir düzeltmedir.

### 3. Supabase Sızdırılmış Şifre Korumasının Etkinleştirilmesi
*   **Etkilenen Servis/Dosya:** Supabase Auth Yapılandırması (HaveIBeenPwned API)
*   **Teknik Adımlar:**
    1.  Supabase projesinin Auth ayarlarına gidilmeli.
    2.  "Leaked Password Protection" seçeneği aktif edilmelidir.
*   **Doğrulama Yöntemi:** `123456` gibi çok popüler ve sızdırılmış bir şifreyle üye olunmaya çalışıldığında Supabase'in bunu reddettiği doğrulanmalıdır.
*   **Geri Alma / Risk Notu:** Kullanıcı şifre güvenliğini artırır.
