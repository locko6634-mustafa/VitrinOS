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

## Sonraki backend aşaması için raporlanan maddeler

Bu maddeler tespit edildi ancak bu turda değiştirilmedi.

| Öncelik | Kaynak | Bulgu | Önerilen sonraki adım |
| --- | --- | --- | --- |
| P0 | `apps/api/src/config.ts` | `SESSION_SECRET`, `MFA_ENCRYPTION_KEY`, `INTERNAL_API_TOKEN`, S3 anahtarları ve webhook sırrı için üretimde kullanılabilecek sabit varsayılanlar var. Ortam değişkeni eksikse tahmin edilebilir anahtarlarla servis başlar. | `production` ortamında bu değerleri zorunlu yapın; varsayılanları yalnızca test ortamına taşıyın ve dağıtım doğrulamasına ekleyin. |
| P1 | `apps/api/src/routes/jobs.ts`, `apps/api/src/routes/internal.ts` | Job yaşam döngüsü `queued → dispatching → processing → succeeded/failed_* /cancelled` iken bazı eski frontend kavramları `approved` ve `revision_requested` etrafında kalmış. | Job onay/revizyon ürün kararını netleştirin; gerekiyorsa API endpointlerini ve durum geçişlerini tek sözleşmede birleştirin. |
| P1 | `js/dashboard.js` ve `apps/api/src/routes/jobs.ts` | Dashboarddaki onay düğmesi şu an API isteği yapmadan yalnızca veriyi yeniden çekiyor. Job route'larında eşleşen bir onay endpointi yok. | Onay akışı gerekiyorsa yetkili `approve` endpointi, durum geçişi, audit kaydı ve UI hata durumu birlikte eklenmeli. |
| P1 | `apps/api/src/routes/admin.ts` | Kullanıcı davet isteğindeki `name` frontendden geliyor ancak route yalnızca e-postayı kullanıyor. | Kullanıcı adı ürün gereksinimiyse şemaya ve kullanıcı kaydına ekleyin; değilse frontend davet formundan alanı kaldırın. |
| P2 | `apps/api/src/routes/config.ts` | Runtime config, frontendin `apiBaseUrl` veya `appBasePath` değerlerini yayınlamıyor. Şu an varsayılan `/api/v1` ve URL çıkarımıyla çalışıyor. | Ters proxy veya alt dizin dağıtımı planlanıyorsa bu iki değeri runtime config sözleşmesine ekleyin. |
| P2 | Canlı entegrasyon | Eski sürüm Supabase Auth/Storage'a, güncel sürüm Fastify/PostgreSQL/MinIO'ya bağlı. Kaynak kod endpointleri eşleşiyor ancak gerçek prod istekleri bu denetimde çalıştırılmadı. | Login, MFA, lead, asset upload, job oluşturma, revizyon ve admin işlemleri için yetkili staging smoke testi yürütün. |

## Sonraki doğrulama sırası

1. Production ortam değişkenleri ve sır yönetimi için P0 maddesini kapatın.
2. Job onay/revizyon durum makinesini API, worker ve n8n boyunca tekleştirin.
3. Yetkili staging hesabıyla uçtan uca smoke testi çalıştırın.
4. Bu rapordaki P1/P2 maddelerini kapattıkça ilgili satırı güncelleyin.
