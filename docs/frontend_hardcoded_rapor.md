# VitrinOS Kalan Frontend Hardcoded ve Teknik Borç Raporu

**Son Güncelleme:** 20 Temmuz 2026  
**Kapsam:** Yapılan responsive esnetmeler ve temizlikler sonrasında kalan iyileştirme alanları.  
**Hedef:** Tamamlanan P0/P1 responsive işlerin ardından, sistem kalitesini artıracak kalan P2/P3 teknik borçların takibi.

---

## 1. Yönetici Özeti

Kök seviyedeki 320 px yatay taşmaları (P0), katı grid alt sınırları (P1), iskelet (shell) boyutlandırmaları (P1), sabit yükseklikler (P1) ve JavaScript dinamik stil basma sorunları (P1) başarıyla çözülmüş ve Playwright testleriyle doğrulanmıştır. 

Ancak CSS ile JavaScript arasındaki breakpoint uyumsuzluğu, yoğun absolute dekorasyonların tam akışkanlığı ve renk literal kullanımları gibi esneklik ve bakım kolaylığını etkileyen teknik borçlar devam etmektedir.

---

## 2. Kalan Önceliklendirilmiş Bulgular

### P2 — Breakpoint Değerleri CSS ve JavaScript Arasında Dağınık

**Kaynaklar**
- `css/index.css` — 1100, 960, 640 px breakpointleri.
- `js/main.js:119` — 960 px kontrolü.
- `css/dashboard.css` — 1180, 1120, 760, 560 px breakpointleri.
- `js/dashboard.js:79` — 1120 px kontrolü.
- `js/config.js:61` — 640 px mobil config değeri.
- `js/config.js:63` ve `js/admin.js:371,421` — 1120 px admin kontrolü.

**Risk**
- CSS'teki responsive tasarımlar değiştikçe JS kontrollerinin (drawer görünürlüğü, `aria-hidden`, odak yönetimi) senkronize kalamayarak arayüzde mantıksal hatalar üretmesi.

**Yapılması Gereken**
- Görsel layout kararlarını tamamen CSS ve container query'ye bırakmak.
- JS tarafındaki breakpoint kontrollerini tek bir merkezi config nesnesinden beslemek.

---

### P2 — Dekoratif Absolute Öğeler Viewport'a Göre Ayarlı

**Kaynaklar**
- `css/index.css` — Orbit/prism boyutları ve konumları.
- `css/login.css` — 20 absolute sahne öğesi, sabit ikon ve prizma ölçüleri.
- `css/set-password.css` — Sabit key-scene elmasları ve negatif 20 px offset'leri.

**Risk**
- Çok dar veya çok yüksek dikey/yatay viewport kombinasyonlarında (örn: dikey mobil ekranlar veya katlanabilir telefonlar) dekorların ana içeriğin veya butonlerin (CTA) üzerine binme riski.

**Yapılması Gereken**
- Dekor öğelerini içeren kapsayıcılara `container-type: inline-size` vermek.
- Konumlandırmalarda viewport (`vw/vh`) yerine container birimleri (`cqi/cqb`), `%` ve `clamp()` kullanmak.
- Kısa/küçük ekranlar için dekorları tamamen gizleyen veya sadeleştiren query kuralları eklemek.

---

### P2 — Tema Tokenları Var, Fakat Doğrudan Renk Literal Kullanımı Yoğun

**Kaynaklar**
- CSS dosyalarında tema renk tokenlarının dışında doğrudan kullanılan 300'den fazla `hsl()/hsla()` ve hex renk literali mevcuttur.

**Risk**
- Yeni bir renk teması (örn: tam karanlık mod) uygulanmak istendiğinde veya marka renkleri değiştiğinde tasarım drift'i oluşması ve bakım maliyetinin artması.

**Yapılması Gereken**
- Tekrarlanan surface, border, muted, danger, overlay ve shadow renk literallerini semantic tokenlara (örn. `--color-surface`, `--color-border-muted`) taşımak.

---

### P3 — HTML Inline Değerleri ve Config Literal'ları

**Kaynaklar**
- `index.html` — Demo seviye ve swatch değerleri inline custom property olarak tanımlı.
- `dashboard.html` — Başlangıç `--bar: 0%` inline olarak basılıyor.
- HTML dosyalarındaki asset yüklemelerindeki manuel `?v=...` cache-buster sürümleri.

**Yapılması Gereken**
- Inline custom property kullanımlarını gerekirse data-attribute veya dinamik modifier sınıflarına dönüştürmek.
- Cache-buster parametrelerini manuel yönetmek yerine deploy/build manifestoları üzerinden dinamik hale getirmek.

---

## 3. Kabul Kriterleri (Kalan Maddeler İçin)

- CSS değiştiğinde JS'in responsive davranışı kırılmamalıdır (Breakpoint senkronizasyonu).
- %200 veya daha yüksek yakınlaştırmalarda absolute dekorasyonlar hiçbir CTA butonunun veya odaklanabilir elemanın üzerini kapatmamalıdır.
- Doğrudan renk literal atamaları tamamen kaldırılmalı, tüm renkler merkezi CSS değişkenlerinden (token) gelmelidir.
