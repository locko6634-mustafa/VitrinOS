# VitrinOS Frontend Hardcoded ve Responsive Yapı Raporu

**Tarih:** 16 Temmuz 2026  
**Kapsam:** `index.html`, kimlik doğrulama sayfaları, `dashboard.html`, `admin.html`, `css/*.css` ve arayüz oluşturan `js/*.js` dosyaları  
**Hedef:** Görsel yapıyı koruyarak viewport, içerik, metin büyütme ve farklı cihaz koşullarına uyum sağlayan full-responsive bir frontend oluşturmak.

> Not: İstekteki “full-response” ifadesi “full-responsive” olarak yorumlanmıştır.

## 1. Yönetici özeti

Frontend tamamen statik değildir; mevcut kodda `clamp()`, `minmax()`, `fr`, `%`, `rem`, `svh/dvh`, `aspect-ratio`, `min-width: 0` ve responsive media query kullanımları vardır. Bu iyi temel korunmalıdır. Ancak layout kararları hâlâ çok sayıda sabit piksel değeri, tekrarlanan breakpoint, sabit grid alt sınırı, fixed/sticky koordinat ve JavaScript inline stili içeriyor.

En kritik doğrulanmış problem, [css/style.css](css/style.css) satır 174 ve [css/index.css](css/index.css) satır 15'teki `min-width: 320px` kuralıdır. Canlı sayfada 320 px test viewport'u dikey scrollbar nedeniyle 305 px kullanılabilir alana düştüğünde hem landing hem login sayfası 320 px genişlikte kalmış ve yaklaşık 15 px yatay taşma üretmiştir. Kök seviyedeki `overflow-x: hidden/clip` sorunun kaynağını çözmek yerine taşan içeriği gizleyebilir.

### Sonuç

- **Genel seviye:** Orta-yüksek responsive teknik borç.
- **Acil konu:** 320 px ve altındaki kök yatay taşma.
- **En riskli dosyalar:** `index.css`, `dashboard.css`, `admin.css`, `login.css`, `dashboard.js`.
- **Doğru hedef:** Sıfır `px` değil; **layout'u belirleyen sabit `px` değerlerini kaldırmak**, yalnız hairline border, ikon geometrisi ve erişilebilir minimum kontrol boyutu gibi gerekçeli istisnaları bırakmak.
- **Önerilen yöntem:** Önce token ve layout altyapısı, sonra sayfa bazlı dönüşüm, en son inline stil/config temizliği ve çoklu viewport doğrulaması.

## 2. Ölçüm özeti

| Dosya | Satır | `px` | `rem` | Viewport birimi | `clamp()` | Media query |
|---|---:|---:|---:|---:|---:|---:|
| `css/index.css` | 2.487 | 438 | 130 | 45 | 36 | 5 |
| `css/dashboard.css` | 1.463 | 254 | 64 | 16 | 14 | 5 |
| `css/admin.css` | 1.204 | 206 | 43 | 13 | 6 | 4 |
| `css/login.css` | 1.524 | 181 | 159 | 35 | 14 | 5 |
| `css/style.css` | 639 | 67 | 17 | 1 | 0 | 2 |
| `css/set-password.css` | 171 | 23 | 3 | 0 | 0 | 2 |
| **Toplam** | **7.488** | **1.169** | **416** | **110** | **70** | **23** |

Bu sayılar tek başına hata sayısı değildir. Örneğin `1px` border ile `minmax(520px, 1fr)` aynı risk sınıfında değildir.

### Konumlandırma yoğunluğu

| Dosya | Absolute | Fixed | Sticky |
|---|---:|---:|---:|
| `index.css` | 28 | 1 | 2 |
| `login.css` | 20 | 1 | 0 |
| `dashboard.css` | 7 | 4 | 1 |
| `admin.css` | 3 | 7 | 4 |
| `set-password.css` | 4 | 0 | 0 |
| `style.css` | 3 | 3 | 0 |

Absolute/fixed kullanımı özellikle dekoratif sahnelerde yoğun. Bunların çoğu kasıtlı olsa da viewport'a göre yazılmış negatif koordinatlar ve sabit boyutlar, içerik büyüdüğünde kırılma riskini artırıyor.

## 3. Canlı responsive doğrulaması

Canlı `https://vitrin-os.vercel.app/` ve `/login.html` sayfaları 900 px yükseklikte, farklı viewport genişlikleriyle salt okunur olarak ölçüldü.

| İstenen viewport | Kullanılabilir client genişliği | Landing scroll genişliği | Login scroll genişliği | Sonuç |
|---:|---:|---:|---:|---|
| 320 | 305 | 320 | 320 | **15 px yatay taşma** |
| 375 | 360 | 360 | 360 | Taşma yok |
| 768 | 753 | 753 | 753 | Taşma yok |
| 1024 | 1009 | 1009 | 1009 | Taşma yok |
| 1440 | 1425 | 1425 | 1425 | Taşma yok |

Dikey scrollbar kullanılabilir genişliği yaklaşık 15 px azalttı. `min-width: 320px` bu nedenle gerçek 320 px cihaz koşulunda bile taşma üretiyor. Landing sayfasındaki orbit/prism/axis gibi dekoratif elemanlar viewport dışına çıkıyor; şu anda üst kapsayıcılardaki `overflow: hidden/clip` ile görünür taşma engelleniyor.

Dashboard ve admin sayfaları oturum gerektirdiği için canlı anonim testte ölçülmedi; bu yüzeyler kod seviyesinde analiz edildi. Uygulama sırasında yetkili oturumla ayrıca tarayıcı testi zorunludur.

## 4. Doğru teknik hedef: “her `px` değerini silmek” değil

`px` eski veya otomatik olarak responsive olmayan bir birim değildir. CSS pikseli erişilebilirlik ve tarayıcı ölçekleme sisteminin tanımlı bir parçasıdır. Sorun, pikselin **layout kapasitesi, kolon genişliği, yükseklik ve konumlandırma için katı bir sınır olarak kullanılmasıdır**.

### Kaldırılması/dönüştürülmesi gereken kullanımlar

- Sayfa ve ana component `min-width`, `width`, `height` değerleri.
- Grid kolonlarındaki `minmax(300px...)`, `minmax(520px...)` gibi içerik dışı sabit eşikler.
- Sabit sidebar/topbar boyutları ve bunları tekrar eden `calc()` ifadeleri.
- Sabit section/hero/panel minimum yükseklikleri.
- İçeriği taşıyabilecek negatif offset ve absolute koordinatlar.
- Sabit gutter, spacing ve container genişlikleri.
- JavaScript ile verilen görsel/layout inline stilleri.
- CSS ve JavaScript'te ayrı ayrı yazılmış breakpoint sayıları.

### Korunabilecek gerekçeli istisnalar

- `1px` hairline border ve separator.
- SVG/CSS ikonlarının iç geometrisi.
- Focus outline kalınlığı.
- Erişilebilir dokunma hedefi alt sınırı. Mevcut 44–48 CSS px kontroller korunmalı veya `2.75rem–3rem` tokenına çevrilmelidir; boyut küçültülmemelidir.
- HTML görsellerindeki `width`/`height` intrinsic oran bilgisi. Örneğin [mfa-setup.html](mfa-setup.html) satır 50'deki QR `width="220" height="220"`, CSS layout kilidi değil tarayıcıya oran/yer ayırma ipucudur; CSS ile `max-inline-size: 100%` sağlandığı sürece kaldırılması gerekmez.

## 5. Önceliklendirilmiş bulgular

### P0 — Kök seviyede 320 px yatay taşma

**Kaynaklar**

- `css/style.css:174` — `body[data-surface] { min-width: 320px; }`
- `css/index.css:15` — marketing body üzerinde tekrar `min-width: 320px`
- `css/style.css:131,176` ve `css/index.css:16` — kök taşmayı `hidden/clip` ile gizleyen kurallar

**Risk**

- 320 px viewport, scrollbar veya browser UI nedeniyle 320 px altında kullanılabilir alana düştüğünde doküman yatay taşıyor.
- `overflow-x` ile kırpma, odaklanan öğenin veya dekor dışı içeriğin görünmez kalmasına neden olabilir.

**Yapılacak**

- Body `min-width` kurallarını kaldır.
- Kök ve ana grid çocuklarına `min-inline-size: 0` uygula.
- Container genişliğini dinamik gutter tokenıyla sınırla.
- `overflow-x: clip` kullanımını yalnız bilerek taşan dekor katmanlarına taşı; kök seviyede problem gizleme yöntemi olarak kullanma.
- 280, 320 ve 360 px genişliklerde otomatik `scrollWidth <= clientWidth` testi ekle.

### P1 — Sabit grid alt sınırları componentleri breakpoint'e bağımlı yapıyor

**Landing örnekleri**

- `css/index.css:316` — hero ikinci kolonu en az `480px`.
- `css/index.css:733` — sistem satırı ikinci kolonu en az `360px`.
- `css/index.css:801` — pipeline kolonları `300px + 480px`.
- `css/index.css:1228` — campaign kolonları `300px + 520px`.
- `css/index.css:1670` — lead kolonları `300px + 520px`.

**Uygulama yüzeyleri**

- `css/dashboard.css:703` — brief kolonları `310px + 390px`.
- `css/admin.css:327,410` — sayfa başı/detail kolonlarında `260px` ve `330px` alt sınırlar.
- `css/login.css:87,1173` — auth/MFA kolonlarında `360px + 480px` ve `470px + 420px` alt sınırlar.

**Mevcut koruma**

Landing 960 px, dashboard/admin 1120 px altında tek kolona geçiyor. Bu sayede yaygın cihazlarda çoğu kırılma engellenmiş.

**Risk**

- Component dar bir parent içine taşınırsa viewport geniş olsa bile yanlış iki kolon düzeninde kalır.
- Uzun Türkçe metin, çeviri, browser zoom veya kullanıcı font ayarı mevcut breakpoint'ten önce taşma yaratabilir.

**Yapılacak**

- Component bazında `container-type: inline-size` kullan.
- Kart gruplarında `repeat(auto-fit, minmax(min(100%, var(--component-min)), 1fr))` yaklaşımına geç.
- Metin + görsel çiftlerinde viewport breakpoint yerine component container query ile tek kolona geç.
- `minmax(0, 1fr)` kullanımını koru; metin kolonlarında `min-inline-size: 0` ve gerektiğinde `overflow-wrap: anywhere` ekle.

### P1 — Dashboard ve admin kabuğu sabit ölçülere bağlı

**Dashboard**

- `css/dashboard.css:58,66,68` — `72px` üst bar ve `248px` kolon.
- `css/dashboard.css:223–233` — aynı `248px/72px` değerleri grid, fixed rail ve viewport hesabında tekrar ediliyor.
- `css/dashboard.css:1141–1157` — 1180 px altında ikinci bir sabit set: `218px`, `270px`, `290px`, `350px`.
- `css/dashboard.css:1176,1229` — drawer ve scrim top offset'i tekrar `72px`.

**Admin**

- `css/admin.css:3–4` — `--admin-rail: 248px`, `--admin-topbar: 72px` tokenlanmış; dashboard'a göre daha iyi.
- `css/admin.css:45` — topbar içerik kolonu `minmax(220px, 1fr)`.
- `css/admin.css:918` — 1180 px altında rail tekrar `214px` oluyor.

**Risk**

- Header yüksekliği içerik/zoom nedeniyle büyürse rail, scrim ve viewport hesapları header ile çakışır.
- Dashboard'da aynı ölçünün farklı selectorlarda tekrarı drift riski oluşturur.

**Yapılacak**

- Dashboard ve admin için ortak shell tokenları tanımla: `--shell-header-size`, `--shell-rail-size`, `--shell-gutter`.
- Örnek yön: `--shell-rail-size: clamp(13.5rem, 18vi, 15.5rem)`; gerçek değer görsel test ile kalibre edilmeli.
- Header'ı mümkün olduğunca içerik temelli `min-block-size` ile bırak; rail başlangıcını tek tokendan hesapla.
- Mobil drawer genişliğini `min(84vi, 19.375rem)` yerine component/container sınırına bağla ve güvenli inline gutter bırak.
- Aynı kabuk davranışını dashboard/admin arasında paylaşılabilir utility veya token katmanına taşı.

### P1 — Sabit minimum yükseklikler kısa ekranlarda ve zoom'da kırılgan

**Örnekler**

- `css/index.css:249` — hero `min-height: max(780px, 100svh)`.
- `css/index.css:902–903` — sticky pipeline `520px–670px` yüksekliğe bağlı.
- `css/index.css:1079` — sahne en az `280px`.
- `css/dashboard.css:520` — panel en az `440px`.
- `css/dashboard.css:876` — kreatif alanı `330px–540px`.
- `css/login.css:1298,1380` — auth sahneleri `650px/560px`.
- `css/set-password.css:43` — key scene `300px`.

**Risk**

- 320×568 gibi kısa ekranlarda gereksiz scroll ve içerik kopması.
- 200% zoom'da sticky/fixed katmanların kullanılabilir alanı tüketmesi.
- Mobil klavye açıldığında `vh` tabanlı alanların yanlış davranması.

**Yapılacak**

- Dekor sahnelerini `aspect-ratio` + `clamp()` + içerik tabanlı block size ile kur.
- Zorunlu tam ekran alanlarında `svh/dvh` ve fallback sıralaması kullan.
- Sticky davranışı yalnız yeterli block-size bulunan containerlarda etkinleştir; kısa ekran query'sinde `position: static` yap.
- `100vh` kullanılan admin hesaplarını `100dvh`/`100svh` stratejisine geçir.

### P1 — JavaScript layout stili üretiyor ve hata bloklarını tekrar ediyor

**Kaynaklar**

- `js/dashboard.js:808–835`
- `js/dashboard.js:884–921`
- `js/dashboard.js:968–995`
- `js/dashboard.js:1064–1077`
- `js/admin.js:905–917`

Dashboard aynı hata/retry görünümünü üç yerde `.style.*` ile kuruyor. Detay grid'i `gridTemplateColumns = "1fr 1fr"`, `gap = "12px"` ile JavaScript'e gömülü. Admin preview görselinin margin/border/radius değerleri de JavaScript'te.

**Risk**

- Responsive kurallar media/container query ile yönetilemiyor.
- Aynı tasarım değerleri CSS tokenlarından kopuyor.
- Hata durumları arasında görsel drift ve bakım maliyeti oluşuyor.

**Yapılacak**

- `.creative-state`, `.creative-state--error`, `.creative-state--retry`, `.creative-detail-grid`, `.admin-preview-img` sınıfları oluştur.
- JS yalnız class, `data-state`, ARIA ve gerçek runtime CSS değişkeni (`--bar` gibi) ayarlasın.
- Detay grid'ini container query ile otomatik tek kolona düşür.
- Tekrarlanan error/retry DOM üretimini tek yardımcı fonksiyonda birleştir.

### P2 — Breakpoint değerleri CSS ve JavaScript arasında dağınık

**Kaynaklar**

- `css/index.css` — 1100, 960, 640 px.
- `js/main.js:119` — tekrar 960 px.
- `css/dashboard.css` — 1180, 1120, 760, 560 px.
- `js/dashboard.js:79` — tekrar 1120 px.
- `js/config.js:61` — dashboard için 640 px config değeri; drawer davranışındaki 1120 px ile aynı kavramı temsil etmiyor.
- `css/admin.css` — 1180, 1120, 700 px.
- `js/config.js:63` ve `js/admin.js:371,421` — admin 1120 px değeri JS davranışına bağlı.

**Risk**

- CSS değişip JS değişmezse menü görünürlüğü, `aria-hidden`, focus yönetimi ve drawer state'i ayrışabilir.

**Yapılacak**

- Breakpointleri cihaz adına göre değil içerik kırılma koşuluna göre adlandır.
- Görsel layout kararlarını mümkün olduğunca CSS/container query'ye bırak.
- JS davranışı gerçekten breakpoint gerektiriyorsa tek config kaynağı kullan ve CSS/JS eşleşmesini otomatik test et.
- `mobileBreakpoint` gibi belirsiz isimleri `navDrawerBreakpoint`, `tableCardBreakpoint` gibi davranış odaklı adlara ayır.

### P2 — Container ve gutter sistemi hâlâ sabit piksel aritmetiği içeriyor

**Kaynaklar**

- `css/style.css:86` — `--vo-container: 1240px`.
- `css/style.css:238` — `calc(100% - 40px)`.
- `css/index.css:37` — `calc(100% - 48px)`.
- `css/index.css:2202–2205` — mobilde `14px` margin.
- Sayfa CSS'lerinde çok sayıda 14/18/20/22/24/28/32 px padding ve gap.

**Yapılacak**

- Ortak tokenlar oluştur:

```css
:root {
  --layout-content-max: 77.5rem;
  --layout-gutter: clamp(0.875rem, 3vi, 2.25rem);
  --space-section: clamp(4rem, 9vb, 9rem);
  --control-min-size: 2.75rem;
}

.container {
  inline-size: min(100% - (2 * var(--layout-gutter)), var(--layout-content-max));
  margin-inline: auto;
  min-inline-size: 0;
}
```

- Fiziksel `width/left/right` yerine `inline-size/inset-inline`, `height/top/bottom` yerine gerektiğinde `block-size/inset-block` kullan.
- Spacing değerlerini tek tek mekanik biçimde `px → rem` çevirmek yerine sınırlı bir akışkan token ölçeğine eşleştir.

### P2 — Dekoratif absolute öğeler viewport'a göre ayarlı

**Örnekler**

- `css/index.css:286–308` — orbit/prism boyutu ve konumu.
- `css/index.css:262,694` — `100vw` ve sabit piksel karışımlı hesaplar.
- `css/login.css` — 20 absolute sahne öğesi ve çok sayıda sabit ikon/prism ölçüsü.
- `css/set-password.css:63–74` — 70 px elmaslar ve negatif 20 px offset.

**Risk**

- Parent component yeniden kullanıldığında öğeler viewport'a göre davranır.
- Kök `overflow-x` kaldırıldığında gerçek taşmalar görünür hale gelebilir.

**Yapılacak**

- Dekor componentlerine `container-type: inline-size` ver; boyut ve offsetlerde `cqi/cqb`, `%`, `clamp()` kullan.
- Dekor katmanını içerikten ayrı bir wrapper içinde `overflow: clip` ile sınırla.
- Dekorların içerik veya focus hedeflerini hiçbir genişlikte kapatmadığını test et.
- Küçük/kısa ekranlarda karmaşık dekoru sadeleştiren query ekle.

### P2 — Admin tablo dönüşümü iyi, ancak en dar genişlikte sabit label kolonu var

`css/admin.css:1088–1144` tabloyu 700 px altında kart düzenine çeviriyor; bu olumlu. Fakat satır içinde `minmax(90px, 0.45fr)` label kolonu kullanılıyor (`css/admin.css:1123`). Çok uzun label, 280–320 px genişlik veya 200% zoom koşulunda değer alanını aşırı daraltabilir.

**Yapılacak**

- Tablo wrapper'ına container query ekle.
- Çok dar componentte label/değer ikilisini tek kolona indir.
- UUID, e-posta, URL ve uzun marka adı için `overflow-wrap: anywhere` uygula.

### P2 — Tema tokenları var, fakat doğrudan renk literal kullanımı yoğun

CSS dosyalarında toplam 329 `hsl()/hsla()` ve 3 hex literal tespit edildi. Bunların bir kısmı tema tokenı veya bilinçli gradient/doku değeridir; tamamı hata değildir. Ancak aynı semantik renklerin componentlerde tekrar yazılması hardcoded tasarım drift'i yaratır.

**Yapılacak**

- Tekrarlanan surface, border, muted, danger, overlay ve shadow renklerini semantic tokena taşı.
- Benzersiz dekor gradientlerini component seviyesinde bırak.
- JS içindeki `var(--error, #e53e3e)` ve `var(--primary, #d9962a)` fallbacklerini CSS sınıfına taşı.

### P3 — HTML inline değerleri ve config literal'ları

**Inline görsel değerler**

- `index.html:205,211` — demo seviye ve swatch değerleri inline custom property.
- `dashboard.html:130–132` — başlangıç `--bar: 0%`.

Bunlar doğrudan layout kilidi değildir. Sıfır inline-style politikası hedefleniyorsa `data-*`/modifier class veya JS runtime custom property akışına taşınabilir. Dinamik bar yüzdesinin CSS custom property olarak ayarlanması kabul edilebilir.

**Config**

- `js/config.js` runtime config ile merkezi override desteğine sahip; bu olumlu.
- Format boyutları, status listeleri, sayfa boyutları, timeout ve limitler domain/config sabitidir; responsive layout hardcode'u değildir.
- `mobileBreakpoint` değerleri ise layout davranışına bağlı olduğu için yukarıdaki breakpoint planına dahil edilmelidir.
- HTML dosyalarındaki farklı `?v=...` cache-buster sürümleri manuel drift riski taşır; mümkünse deploy/build manifestinden yönetilmelidir.

## 6. Dosya bazlı risk matrisi

| Dosya | Risk | Ana konu | Dönüşüm yönü |
|---|---|---|---|
| `css/style.css` | Yüksek | Kök `min-width`, container ve ortak sabit tokenlar | Önce temel token ve root overflow düzeltmesi |
| `css/index.css` | Yüksek | En fazla `px`, geniş grid minimumları, sabit hero/sticky sahneler, yoğun dekor | Component container query + akışkan sahne sistemi |
| `css/dashboard.css` | Yüksek | Tekrarlanan 72/248 shell ölçüleri, brief grid, sabit panel yükseklikleri | Ortak shell tokenı + component responsive grid |
| `css/admin.css` | Orta-yüksek | Shell/sidebar, sticky max-height, tablo label kolonu | Shell tokenı + container-query tablo/detail |
| `css/login.css` | Orta-yüksek | Geniş auth kolon minimumları ve sabit dekor sahneleri | Auth container query + aspect/clamp sahne |
| `css/set-password.css` | Orta | Sabit 300 px sahne ve 54/70/92 px dekor | Parent ölçüsüne bağlı component ölçeği |
| `js/dashboard.js` | Yüksek | Tekrarlanan inline layout stilleri | Class/state tabanlı render |
| `js/admin.js` | Orta | Preview inline stilleri | CSS sınıfına taşıma |
| `js/main.js` / `js/admin.js` | Orta | CSS ile tekrarlanan breakpointler | Davranış odaklı tek kaynak veya CSS kontrolü |
| HTML dosyaları | Düşük | Az sayıda inline custom property/cache sürümü | İsteğe bağlı inline-style ve asset-version temizliği |

## 7. Güçlü ve korunması gereken mevcut uygulamalar

- Tüm ana HTML sayfalarında doğru viewport meta etiketi var.
- Typography büyük ölçüde `rem` ve `clamp()` kullanıyor; piksel font-size tespit edilmedi.
- `minmax(0, 1fr)` ve `min-width: 0` kritik grid alanlarında kullanılmış.
- Dashboard görsellerinde `aspect-ratio` ve `object-fit` tanımları var.
- `overflow-wrap: anywhere` bazı dinamik metin alanlarında mevcut.
- Admin tablosu mobilde kart düzenine dönüşüyor.
- Dashboard/admin sidebar'ları 1120 px altında drawer oluyor.
- Landing 960 px ve 640 px altında belirgin tek kolon/mobil düzenlere geçiyor.
- Reduced-motion ve bazı contrast tercihleri ele alınmış.

Bu altyapı yeniden yazılmamalı; dönüşüm mevcut sistem üzerine kontrollü yapılmalıdır.

## 8. Uygulama planı

### Faz 0 — Baseline ve regresyon ağı

1. Landing, login, dashboard, admin, MFA ve şifre sayfalarının mevcut desktop/tablet/mobile ekran görüntülerini al.
2. Şu genişliklerde otomatik yatay taşma kontrolü kur: 280, 320, 360, 375, 390, 640, 768, 960, 1024, 1120, 1280, 1440, 1920.
3. 200% ve mümkünse 400% browser zoom; uzun Türkçe metin, UUID, e-posta, URL, boş/loading/error state senaryolarını fixture olarak hazırla.
4. Bilinçli yatay scroll alanları varsa allowlist oluştur; doküman seviyesinde scroll hiçbir genişlikte kabul edilmemeli.

### Faz 1 — Ortak responsive token altyapısı

1. `style.css` içinde content max, gutter, section spacing, shell header/rail, control size ve dekor ölçek tokenlarını oluştur.
2. Layout tokenlarında `rem`, `clamp()`, `%`, `fr`, mantıksal özellikler ve gerektiğinde viewport/container birimleri kullan.
3. `body min-width: 320px` kurallarını kaldır; root overflow'u gerçek componentlere taşı.
4. İzin verilen `px` istisnalarını kısa bir yorum/allowlist ile belgele.

### Faz 2 — Landing ve auth yüzeyleri

1. `index.css` grid minimumlarını component container query sistemine geçir.
2. Hero/pipeline/campaign/lead sahnelerindeki sabit minimum yükseklikleri `aspect-ratio`, içerik ve kısa-ekran query'leriyle dönüştür.
3. Orbit/prism/axis dekorlarını parent containera bağla.
4. `login.css` ve `set-password.css` sahnelerini aynı akışkan dekor tokenlarıyla ölçekle.
5. 280–960 px arası ara genişlikleri test et; yalnız klasik 320/768 noktalarına güvenme.

### Faz 3 — Dashboard ve admin shell

1. Dashboard'daki tekrarlanan 72/248 px değerlerini shell tokenına taşı.
2. Admin ve dashboard rail/header davranışını hizala.
3. Brief, detail, metric ve form gridlerini container query/auto-fit ile içerik temelli hale getir.
4. Sticky panelleri kısa viewport ve zoom koşulunda statik düzene düşür.
5. Admin tablo kartlarını en dar componentte tek kolon label/değer yap.

### Faz 4 — JavaScript ve inline style temizliği

1. Dashboard error/retry bloklarını tek renderer + CSS class sistemine dönüştür.
2. Dashboard detail grid ve admin preview stillerini CSS'e taşı.
3. JS `.style.*` kullanımını yalnız runtime değerleri için sınırla: progress yüzdesi, pointer koordinatı gibi CSS custom property verileri.
4. Breakpoint bağımlı JS davranışlarını tek config kaynağına veya CSS kontrollü state'e geçir.

### Faz 5 — Tasarım ve config hardcode standardizasyonu

1. Tekrarlanan renk/shadow/radius/spacing değerlerini semantic tokenlara taşı.
2. `mobileBreakpoint` isimlerini davranış bazlı ayır.
3. HTML asset query versionlarını merkezi deploy/build sürecine bağla.
4. Inline demo custom propertylerini yalnız sıfır-inline-style hedefleniyorsa modifier/data sistemine geçir.

### Faz 6 — Son doğrulama ve kademeli teslim

1. Her fazı ayrı küçük commit olarak uygula; görsel regresyon oluşursa kaynağı kolay izlenebilsin.
2. Önce landing/auth, sonra dashboard/admin yayınla.
3. Desktop ve mobil tarayıcı doğrulamasını değişiklik grupları tamamlandıktan sonra çalıştır.
4. Push sonrası Vercel canlı deploy sonucunu ve console hatalarını kontrol et.

## 9. Kabul kriterleri

- 280–1920 px aralığında `document.scrollWidth <= document.documentElement.clientWidth` olmalı; yalnız açıkça tasarlanmış iç scroll containerları istisna.
- 320 px testte mevcut 15 px yatay taşma tamamen kalkmalı.
- 200% zoom'da ana işlevler ve içerik kaybolmamalı; fixed/sticky yüzeyler içeriği kapatmamalı.
- Uzun marka adı, e-posta, UUID, URL ve hata mesajı hiçbir kart/grid'i genişletmemeli.
- Ana layout ölçülerinde çıplak `px` bulunmamalı; yalnız belgelenmiş mikro-istisnalar kalmalı.
- JS içinde görsel/layout `.style.*` ataması bulunmamalı; yalnız gerçek runtime CSS custom property değerleri kabul edilmeli.
- Component düzeni yalnız viewport'a değil, kendi kullanılabilir inline alanına tepki vermeli.
- Root `overflow-x: hidden/clip` kırık layout'u maskelemek için kullanılmamalı.
- Dokunma hedefleri en az 44 CSS px eşdeğerinde kalmalı.
- Landing, login, dashboard ve admin için mobile/tablet/desktop console hatası olmamalı.
- Mevcut görsel hiyerarşi, marka karakteri ve temel etkileşimler korunmalı.

## 10. Önerilen ilk uygulama paketi

İlk güvenli paket yalnız temel sorunu ve altyapıyı hedeflemelidir:

1. `body min-width: 320px` tekrarlarını kaldır.
2. Akışkan gutter/container tokenlarını ekle.
3. 280/320/360 px yatay taşma testini oluştur.
4. Landing ve login sayfalarını bu testlerle doğrula.
5. Ardından grid/shell dönüşümlerine ayrı paketlerde geç.

Bu sıra, tüm `px` değerlerini tek seferde mekanik olarak değiştirip mevcut tasarımı bozma riskini azaltır.
