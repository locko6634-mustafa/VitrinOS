# VitrinOS Ajan Yönergeleri

Bu dosya VitrinOS projesinde çalışan ajanların tekil proje bağlamıdır. Tüm ajanlar bu kuralları öncelemeli, tahmin yerine canlı kaynaklardan doğrulama yapmalıdır.

## Dil ve İletişim

- Kullanıcıyla her zaman Türkçe iletişim kur.
- Plan, özet, durum mesajı ve teslim notlarını kısa, net ve uygulanabilir yaz.
- Uzun açıklama gerekiyorsa ayrı bir markdown dosyası oluştur; sohbet içinde aynı içeriği tekrar etme.

## Proje Özeti

VitrinOS, e-ticaret markaları için AI destekli pazarlama görselleri üreten vanilla HTML/CSS/JS tabanlı bir web uygulamasıdır. Proje canlıda `https://vitrin-os.vercel.app/` adresinde çalışmaktadır.

Ana akış:
1. Kullanıcı `dashboard.html` üzerinden brief oluşturur veya revizyon ister.
2. Frontend Supabase Edge Function çağırır.
3. Edge Function n8n `VitrinOS_BASE` webhookunu tetikler.
4. n8n Supabase'den marka ve prompt verilerini alır.
5. n8n briefi analiz edip uygun alt workflowa yönlendirir.
6. Görsel üretilir, Supabase Storage `generated-assets` altına yazılır.
7. `jobs` kaydı güncellenir ve dashboard sonucu gösterir.

## Yerel Dosya Haritası

- `index.html`: Landing page ve lead formu.
- `login.html`: Kullanıcı ve admin girişi.
- `dashboard.html`: Brief, iş takibi, onay ve revizyon ekranı.
- `admin.html`: Marka, prompt ve iş yönetimi ekranı.
- `css/`: Sayfa bazlı ve ortak stiller.
- `js/config.js`: Supabase URL, publishable key, function slugları ve istemci ayarları.
- `js/supabase.js`: Supabase istemci sarmalayıcısı ve auth yardımcıları.
- `js/dashboard.js`: Dashboard iş akışı.
- `js/admin.js`: Admin panel iş akışı.
- `js/lead-form.js`: Lead formu gönderimi.
- `supabase/migrations/`: Şema, RLS, storage ve güvenlik migrationları.
- `supabase/functions/submit-lead/`: Lead kabul edge function kaynak kodu.
- `supabase/functions/trigger-brief/`: Brief tetikleme edge function kaynak kodu.

## Çalıştırma ve Browser Doğrulama

- Proje canlıda `https://vitrin-os.vercel.app/` adresinde çalışmaktadır. Geliştirme ve doğrulamalar bu canlı URL bağlamı göz önüne alınarak yapılmalıdır.
- Yerel sunucu doğrulama için `http://localhost:8000` adresinde kullanılabilir, ancak nihai yayına alım ve entegrasyon doğrulamaları canlı URL temelinde gerçekleştirilmelidir.
- Browser özelliğiyle doğrulama yapılırken ana ekran, login, dashboard ve admin yüzeylerinde kırık layout, konsol hatası ve temel etkileşimler kontrol edilmelidir.
- Her küçük değişiklikten sonra tarayıcı testi döngüsü başlatma; değişiklikleri grupla, sonra doğrula.

## Supabase Kaynak Kuralı

- Supabase hakkında karar verirken yerel dosyalar tek başına kaynak kabul edilmez.
- Supabase proje durumu, tablolar, migrationlar, edge functionlar ve loglar MCP ile kontrol edilmelidir.
- MCP bağlantısı hata verirse eski bilgiye, README'ye veya hafızaya güvenerek işlem yapma; hatayı kullanıcıya bildir ve canlı doğrulama iste.
- `SELECT *` kullanma; sadece gereken kolonları sorgula.
- Public veya Data API'ye açık şemalarda RLS zorunludur.
- `service_role` veya secret key frontend dosyalarına yazılamaz.

## Supabase Canlı Envanteri

MCP ile doğrulanan proje:

- Proje adı: `VitrinOS Data Base`
- Project ref: `wrzalebhnlwppufdcmiz`
- Bölge: `eu-west-1`
- Postgres: `17`
- Frontend URL: `https://wrzalebhnlwppufdcmiz.supabase.co`
- Publishable key konumu: `js/config.js`

MCP ile görülen ana tablolar:

- `public.brands`: Marka, logo, web sitesi, renk paleti, ses tonu ve yasaklı kelime verileri.
- `public.brand_prompts`: Banner, Story, Meta Post ve revizyon prompt şablonları.
- `public.jobs`: Brief, format, durum, görsel yolu, revizyon ve normalize LLM çıktısı.
- `public.leads`: Landing formundan gelen aday müşteri kayıtları.
- `public.users`: Auth kullanıcısına bağlı uygulama kullanıcı profili.
- `public.lead_submission_attempts`: Lead form güvenliği için rate limit, duplicate ve honeypot deneme kayıtları.
- `storage.buckets`: Storage bucket kayıtları; canlı ortamda 1 bucket görünüyor.
- `storage.objects`: Üretilen dosya objeleri; `generated-assets` akışında kullanılır.

MCP ile görülen migrationlar:

- `20260707114748_create_vitrinos_core_schema`
- `20260707115317_tighten_vitrinos_rls_policies`
- `20260707224956_restrict_job_owner_updates`
- `20260707225147_restrict_job_owner_inserts`
- `20260708092822_add_auth_user_admin_schema`
- `20260708102438_secure_lead_submission`

MCP ile görülen aktif edge function:

- `submit-lead`: Aktif, `verify_jwt=false`.

Not: Yerelde `trigger-brief` function klasörü ve `supabase/config.toml` içinde `verify_jwt=true` ayarı var; MCP envanterinde bu function aktif listede görünmedi. Bu konuda işlem yapmadan önce MCP ile tekrar doğrula.

## n8n Kaynak Kuralı

- n8n hakkında karar verirken yerel dosya arama veya tahmin kullanma.
- Workflow arama ve inceleme için n8n MCP araçlarını kullan.
- Doğrudan workflow oluşturma, güncelleme, publish etme veya silme işlemi yapma. Gerekirse kullanıcıya n8n arayüzünde uygulanacak manuel adımları yaz.
- n8n MCP hata verirse cached bilgiyle işlem yapma; hatayı kullanıcıya bildir.
- Workflow detaylarında gereksiz tam JSON dökümü isteme veya sohbet ekranına basma; sadece gerekli düğüm, tetikleyici ve veri akışını özetle.

## n8n Canlı Workflow Envanteri

MCP ile `VitrinOS` araması sonucu 5 aktif workflow doğrulandı.

### `VitrinOS_BASE`

- ID: `Iw2pZ3MXze7yofqI`
- Durum: Aktif
- Tetikleyici: `POST /webhook/vitrinos-brief`
- Base URL: `https://server.n8n-mustafa.me/`
- Rol: Ana orkestrasyon workflowu.
- İşlev: Yeni brief ve revizyon isteklerini ayırır, `jobs` durumunu `processing` yapar, `brands` ve `brand_prompts` verilerini Supabase'den çeker, LLM ile briefi normalize eder, format router ile `VitrinOS_META_POST`, `VitrinOS_STORY` veya `VitrinOS_BANNER` workflowuna yönlendirir. Revizyon isteklerinde revizyon limitini kontrol eder, eski görseli indirir ve `VitrinOS_REVIZE` workflowunu çağırır. Çıktıyı Supabase Storage'a yükleyip `jobs` kaydını günceller.

### `VitrinOS_META_POST`

- ID: `TjIBuLmyigpNjBnV`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır; production webhook yok.
- Rol: Instagram post üretimi.
- İşlev: Meta Post için metin/caption ve görsel prompt üretir. Ürün görseli varsa ürünü indirir, arka plan üretir, GPT image edit ile ürünü sahneye entegre eder. Ürün görseli yoksa doğrudan görsel üretim yoluna gider. Jimp ile 1080x1350 çıktıya dönüştürür ve marka logosunu yerleştirir.

### `VitrinOS_STORY`

- ID: `36iRYjVaLyqIdo6z`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır; production webhook yok.
- Rol: Instagram/Facebook Story üretimi.
- İşlev: Story metin ve görsel promptlarını üretir. Ürün görseli varsa 1080x1920 dikey story güvenli alan kurallarına göre arka plan ve ürün entegrasyonu yapar. Jimp ile story boyutuna dönüştürür ve marka logosunu üst güvenli alana yerleştirir.

### `VitrinOS_BANNER`

- ID: `gjzjuE91iiU2Ew0G`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır; production webhook yok.
- Rol: Web banner üretimi.
- İşlev: Banner metni ve görsel promptu üretir. Brief içindeki genişlik/yüksekliği korumaya çalışır, varsayılan olarak 1600x600 kullanır. Ürün görseli varsa ürünü banner sahnesine entegre eder; yoksa doğrudan görsel üretir. Jimp ile hedef banner çözünürlüğüne dönüştürür.

### `VitrinOS_REVIZE`

- ID: `n3BDaxJj7FnIMCIq`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır; production webhook yok.
- Rol: Mevcut görsel revizyonu.
- İşlev: Revizyon notu, orijinal brief, format, prompt ve mevcut image path alır. Eski görseli Supabase Storage'dan indirir, GPT image edit ile revize eder, orijinal çözünürlüğe döndürür ve ana workflowa binary çıktı verir.

## GitHub Commit, Push ve Deploy Disiplini

- Düşük riskli değişikliklerde kullanıcıdan ayrıca onay bekleme: değişikliği uygula, ilgili kontrolleri çalıştır, mevcut dalda anlamlı bir commit oluştur ve GitHub'a pushla.
- Düşük risk kapsamı: frontend HTML/CSS/JS düzeltmeleri, dokümantasyon, testler, hata düzeltmeleri ve geri alınabilir arayüz iyileştirmeleri.
- Aşağıdaki durumlarda commit/push/deploy öncesi kullanıcı onayı iste: Supabase/n8n/hosting tarafında kalıcı değişiklik, migration veya RLS değişikliği, kimlik bilgileri/secret/config değişikliği, veri silme veya dönüşü olmayan işlemler, büyük kapsamı belirsiz değişiklikler.
- Push sonrası Vercel gibi GitHub bağlı otomatik deploy sistemi varsa deploy'un push ile tetiklenmesini bekle ve sonucu kontrol et; bağımsız production deploy komutu çalıştırma.
- Kullanıcı tarafından istenmeyen mevcut değişiklikleri geri alma veya üzerine yazma.

## Güvenlik ve Değişiklik Disiplini

- Kullanıcı değişikliklerini geri alma.
- Migration eklemeden önce canlı şema ve RLS durumunu MCP ile doğrula.
- n8n veya Supabase tarafında kalıcı değişiklik gerekiyorsa önce etki alanını yaz, sonra kullanıcı onayı iste.
- Frontend değişikliklerinde vanilla HTML/CSS/JS yaklaşımını koru; gereksiz framework ekleme.
- Görsel ve layout değişikliklerinde desktop ve mobil görünümü browser ile doğrula.
