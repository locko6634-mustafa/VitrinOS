# Backend Geçişi Sonrası Frontend ve Sözleşme Denetimi

Tarih: 23 Temmuz 2026  
Karşılaştırılan sürümler:

- Güncel: `VitrinOS`
- Referans: `VitrinOS-44b3441953fa3c4beff68eed59437bd6c6c6e6f7`

## Kapsam ve yöntem

Tüm HTML ve CSS dosyaları dosya karması ve satır farkı ile karşılaştırıldı. Güncel Fastify route kaynakları, frontendin kullandığı endpointlerle eşleştirildi. Bu turda backend, veritabanı, n8n, depolama veya kimlik bilgileri değiştirilmedi.

## Bu turda düzeltilen frontend eksikleri

| Alan | Bulgu | Uygulanan düzeltme |
| --- | --- | --- |
| Ana sayfa başvuru formu | `js/lead-form.js`, `window.VitrinOS.api` kullanmasına rağmen `index.html` içinde `js/api-client.js` yüklenmiyordu. | API istemcisi, form betiğinden önce yüklendi. |
| Dashboard ayarlar bölümü | `dashboard.html` içinde fazladan bir `</div>` bulunuyordu; kart yerleşimini bozma riski vardı. | Fazla kapanış etiketi kaldırıldı. |
| Admin stilleri | Yönetim ekranı gereksiz olarak `dashboard.css` de yüklüyordu. | Sadece `style.css` ve `admin.css` bırakıldı. |
| Admin genel bakış | Referans tasarımdaki iki kompakt operasyon kartı yerine büyük sayaç kartları görünüyordu. | Referans hiyerarşisine dönüldü; son job ve başvuru listeleri mevcut REST verisiyle dolduruluyor. |
| Admin menüsü | Başlangıçta Marka sekmesi de aktif kalabiliyor, eski numaralı menü hiyerarşisi korunmuyordu. | Tek aktif sekme, numaralı menü ve canlı sistem notu geri getirildi. |
| Admin kullanıcı filtresi | Frontend `inactive` gönderiyordu; API `suspended` kullanıyor. | Filtre değeri `suspended` olarak güncellendi. |
| Admin job filtresi | Eski Supabase durumları (`pending`, `completed` vb.) kullanılıyordu. | Fastify iş akışındaki durumlar (`queued`, `dispatching`, `succeeded`, vb.) ile eşitlendi. |
| Durum etiketleri | Ortak frontend yapılandırması yeni job durumlarının tamamını tanımıyordu. | Türkçe etiketler ve admin tablo gösterimi güncellendi. |

## HTML/CSS karşılaştırma özeti

| Yüzey | Görsel/CSS farkı | Değerlendirme |
| --- | --- | --- |
| `index.html` + `css/index.css` | CSS aynı. HTML farkları canonical/OG URL ve script kaynaklarıyla sınırlı. | Self-hosted dağıtım için göreli URL tercihinin korunması doğru. |
| `login.html`, `mfa-*.html`, `set-password.html` | CSS aynı. HTML farkları Supabase betikleri yerine self-hosted auth istemcilerine geçiş. | Görsel kayıp bulunmadı. |
| `dashboard.html` + `css/dashboard.css` | CSS aynı. Hazırlık kartı metinleri yeni altyapıyı yansıtıyor. Fazladan kapanış etiketi bulundu. | Etiket düzeltildi; altyapı metinleri korunuyor. |
| `admin.html` + `css/admin.css` | Geçiş sırasında admin kabuk/menü hiyerarşisi referans tasarımdan ayrılmıştı. | Referans görünüm geri kuruldu; self-hosted REST bağları korundu. |

## Backend aşaması sonuçları

Raporlanan backend maddeleri ikinci turda kaynak, migration ve frontend sözleşmesi düzeyinde kapatıldı. Canlı staging çağrısı için de kimlik bilgisi gerektirmeyen bir smoke komutu eklendi.

| Öncelik | Kaynak | Bulgu | Önerilen sonraki adım |
| --- | --- | --- | --- |
| Durum | Kaynak | Uygulanan çözüm |
| --- | --- | --- |
| Kapandı | `apps/api/src/config.ts` | Production modunda veritabanı, oturum, MFA, n8n, S3 ve internal token değerleri ortam değişkeni olarak zorunlu. Eksik değerle API başlamaz. |
| Kapandı | `apps/api/src/routes/jobs.ts` | Tek durum sözleşmesi tanımlandı: `succeeded → approved` ve `succeeded/approved → queued` revizyon geçişleri. Onay/revizyon event, outbox ve audit kaydı üretir. |
| Kapandı | `js/dashboard.js` | Onay ve revizyon düğmeleri artık sırasıyla `/approve` ve `/revision` endpointlerini çağırır. |
| Kapandı | `packages/db` ve `apps/api/src/routes/admin.ts` | Davet kullanıcı adı `display_name` alanına kaydedilir; migration `0001_complex_charles_xavier.sql` oluşturuldu. |
| Kapandı | `apps/api/src/routes/config.ts` | `apiBaseUrl` ve `appBasePath`, runtime config ile frontend'e yayınlanır. |
| Hazır | `quality/scripts/staging-smoke.mjs` | `npm run staging:smoke` canlılık, hazır olma, runtime config ve sayfa erişimini denetler. `STAGING_SESSION_COOKIE` verilirse oturum endpointini de kontrol eder. |

## Sonraki doğrulama sırası

1. Production ortam değişkenlerini dağıtım gizli değer deposuna ekleyin.
2. Migration `0001_complex_charles_xavier.sql` dosyasını staging, sonra production ortamında uygulayın.
3. `STAGING_BASE_URL` ile smoke komutunu çalıştırın; oturum denetimi için geçici test oturumu sağlayın.
