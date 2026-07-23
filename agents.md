# VitrinOS Ajan Yönergeleri

Bu dosya VitrinOS projesinde çalışan ajanların tekil proje bağlamıdır. Tüm ajanlar bu kuralları öncelemeli, tahmin yerine canlı kaynaklardan doğrulama yapmalıdır.

## Dil ve İletişim

- Kullanıcıyla her zaman Türkçe iletişim kur.
- Plan, özet, durum mesajı ve teslim notlarını kısa, net ve uygulanabilir yaz.
- Uzun açıklama gerekiyorsa ayrı bir markdown dosyası oluştur; sohbet içinde aynı içeriği tekrar etme.

## Proje Özeti

VitrinOS, e-ticaret markaları için AI destekli pazarlama görselleri üreten vanilla HTML/CSS/JS tabanlı bir web uygulamasıdır. Proje tamamen self-hosted (kendi sunucumuzda) çalışmaktadır.

Ana akış:
1. Kullanıcı `dashboard.html` üzerinden brief oluşturur veya revizyon ister.
2. Frontend self-hosted REST API (`/api/v1`) istemcisi üzerinden istek atar.
3. Node.js API servisi (`apps/api`) n8n `VitrinOS_BASE` webhookunu tetikler.
4. n8n PostgreSQL veritabanından marka ve prompt verilerini alır.
5. n8n briefi analiz edip uygun alt workflowa yönlendirir.
6. Görsel üretilir, S3/MinIO Storage (`generated-assets`) altına yazılır.
7. Veritabanındaki `jobs` kaydı güncellenir, SSE (Server-Sent Events) canlı bildirimi tetiklenir ve dashboard sonucu gösterir.

## Yerel Dosya Haritası

- `index.html`: Landing page ve lead formu.
- `login.html`: Kullanıcı ve admin girişi.
- `dashboard.html`: Brief, iş takibi, onay ve revizyon ekranı.
- `admin.html`: Marka, prompt ve iş yönetimi ekranı.
- `mfa-setup.html`: MFA kurulum ekranı.
- `mfa-challenge.html`: MFA doğrulama ekranı.
- `apps/api`: Self-hosted Express.js REST API servisi.
- `apps/worker`: Arka plan işleyici servis.
- `packages/db`: PostgreSQL veritabanı şema ve erişim paketi.
- `packages/storage`: S3/MinIO depolama yöneticisi.
- `packages/shared`: Ortak tipler ve yardımcılar.
- `infra/compose`: Docker Compose konfigürasyonları.
- `css/`: Sayfa bazlı ve ortak stiller.
- `js/config.js`: Çalışma zamanı konfigürasyonları ve varsayılan ayarlar.
- `js/api-client.js`: Self-hosted REST API istemcisi.
- `js/auth-store.js`: JWT ve oturum durum yöneticisi.
- `js/sse-client.js`: Gerçek zamanlı SSE (Server-Sent Events) istemcisi.
- `js/dashboard.js`: Dashboard iş akışı.
- `js/admin.js`: Admin panel iş akışı.
- `js/lead-form.js`: Lead formu gönderimi.

## Çalıştırma ve Browser Doğrulama

- Proje self-hosted olarak kendi sunucumuzda çalışmaktadır. Geliştirme ve doğrulamalar kendi sunucu bağlamınız veya yerel ortam göz önüne alınarak yapılmalıdır.
- Yerel sunucu başlatmak için `sunucu_baslat.ps1` veya `run_server.bat` kullanabilirsiniz.
- Yerel doğrulamada `http://localhost:8000` (veya ilgili port) adresi kullanılır.
- Browser özelliğiyle doğrulama yapılırken ana ekran, login, dashboard ve admin yüzeylerinde kırık layout, konsol hatası ve temel etkileşimler kontrol edilmelidir.
- Her küçük değişiklikten sonra tarayıcı testi döngüsü başlatma; değişiklikleri grupla, sonra doğrula.

## Backend & Veritabanı Kaynak Kuralı

- Veritabanı veya API hakkında karar verirken sadece varsayımlara güvenmeyin.
- `apps/api` ve `packages/db` altındaki şemaları ve endpoint sözleşmelerini inceleyin.
- Frontend'de hiçbir zaman gizli secret key veya hassas veritabanı şifreleri açık şekilde bulundurulamaz.
- `SELECT *` kullanımından kaçının; sadece gerekli kolonları sorgulayın.
- Veritabanı erişimleri ve güncellemeleri yetkilendirme süzgecinden (JWT & Rol Kontrolleri) geçmelidir.

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
- İşlev: Yeni brief ve revizyon isteklerini ayırır, `jobs` durumunu `processing` yapar, `brands` ve `brand_prompts` verilerini veritabanından çeker, LLM ile briefi normalize eder, format router ile `VitrinOS_META_POST`, `VitrinOS_STORY` veya `VitrinOS_BANNER` workflowuna yönlendirir. Revizyon isteklerinde revizyon limitini kontrol eder, eski görseli indirir ve `VitrinOS_REVIZE` workflowunu çağırır. Çıktıyı Storage'a yükleyip `jobs` kaydını günceller.

### `VitrinOS_META_POST`

- ID: `TjIBuLmyigpNjBnV`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır.
- Rol: Instagram post üretimi.

### `VitrinOS_STORY`

- ID: `36iRYjVaLyqIdo6z`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır.
- Rol: Instagram/Facebook Story üretimi.

### `VitrinOS_BANNER`

- ID: `gjzjuE91iiU2Ew0G`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır.
- Rol: Web banner üretimi.

### `VitrinOS_REVIZE`

- ID: `n3BDaxJj7FnIMCIq`
- Durum: Aktif
- Tetikleyici: Ana workflow tarafından çağrılır.
- Rol: Mevcut görsel revizyonu.

## GitHub Commit, Push ve Deploy Disiplini

- Düşük riskli değişikliklerde kullanıcıdan ayrıca onay bekleme: değişikliği uygula, ilgili kontrolleri çalıştır, mevcut dalda anlamlı bir commit oluştur ve GitHub'a pushla. Bu kural frontend, dokümantasyon, testler ve riskli olmayan backend/n8n/hosting değişiklikleri için de geçerlidir.
- Düşük risk kapsamı: frontend HTML/CSS/JS düzeltmeleri, dokümantasyon, testler, hata düzeltmeleri ve geri alınabilir arayüz iyileştirmeleri.
- Aşağıdaki durumlarda commit/push/deploy öncesi kullanıcı onayı iste: veri kaybı riski taşıyan veya geri dönüşü zor veritabanı/n8n/hosting değişikliği, migration değişikliği, kimlik bilgileri/secret/config değişikliği, veri silme veya dönüşü olmayan işlemler.
- Her tamamlanan değişiklik grubundan sonra kapsamı doğru yansıtan anlamlı bir commit oluştur ve doğrulamalar başarılıysa GitHub'a pushla.

## Güvenlik ve Değişiklik Disiplini

- Kullanıcı değişikliklerini geri alma.
- n8n veya backend tarafında kalıcı değişiklik gerekiyorsa önce etki alanını yaz, sonra kullanıcı onayı iste.
- Frontend değişikliklerinde vanilla HTML/CSS/JS yaklaşımını koru; gereksiz framework ekleme.
- Görsel ve layout değişikliklerinde desktop ve mobil görünümü browser ile doğrula.
