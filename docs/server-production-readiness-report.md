# VitrinOS Sunucu Production Uygunluk Raporu

**Tarih:** 18 Temmuz 2026  
**Sunucu:** `MRS-SNC-TB8500`  
**İncelenen alanlar:** Ubuntu, SSH, firewall, Fail2ban, Docker, n8n, Chatwoot, TLS, yedekleme, izleme ve VitrinOS kapasitesi  
**Yöntem:** SSH-MCP ile salt-okunur kontroller ve kullanıcı tarafından iletilen root denetim çıktıları

## Yönetici özeti

### Nihai puan: 6,4 / 10

Sunucunun temel güvenlik katmanı önceki duruma göre ciddi biçimde iyileştirilmiştir. SSH yalnızca anahtar ile çalışmakta, root ve parola girişi kapalıdır. UFW etkin, varsayılan gelen trafik politikası `deny`, dışarı açık servisler yalnızca SSH ve Traefik portlarıdır. Fail2ban, otomatik güvenlik güncellemeleri, NTP, TLS ve temel container çalışma durumu sağlıklıdır.

Buna rağmen sunucu henüz VitrinOS production yayını için tam hazır değildir. Ana engeller:

1. Hassas `.env` ve yedek dosyalarının yerel kullanıcılara okunabilir olması.
2. `/home/n8n_depo` dizininin herkese yazılabilir (`777`) olması.
3. Yedeklerin yalnızca aynı sunucuda bulunması ve restore testinin doğrulanmamış olması.
4. Chatwoot PostgreSQL dump dosyalarının şüpheli derecede küçük olması.
5. `vitrinos-backup` servisinin başarısız çalışmış olması.
6. Container CPU, RAM ve process limitlerinin bulunmaması.
7. Tüm container'ların aynı Docker ağına bağlı olması.
8. Chatwoot, Redis ve PostgreSQL için healthcheck bulunmaması.
9. Production monitoring ve alarm mekanizmasının görünmemesi.

**Karar:** P0 ve P1 maddeleri giderilmeden VitrinOS production trafiği açılmamalıdır. P0/P1 maddeleri tamamlanır, backup restore testi geçer ve VitrinOS staging yük testi başarılı olursa mevcut sunucu düşük trafikli ilk production/MVP dönemi için kullanılabilir.

## Puan kırılımı

| Alan | Puan | Durum |
|---|---:|---|
| İşletim sistemi ve güncellemeler | 9,0/10 | Sağlıklı |
| SSH erişim güvenliği | 9,0/10 | Güçlü |
| Firewall ve dış saldırı yüzeyi | 8,5/10 | İyi |
| TLS ve HTTP güvenliği | 8,0/10 | İyi, birkaç eksik başlık var |
| Secret ve dosya izinleri | 3,0/10 | Kritik düzeltme gerekli |
| Docker izolasyonu | 5,0/10 | Limit ve segmentasyon eksik |
| Yedekleme ve felaket kurtarma | 3,5/10 | Yerel otomasyon var; güvenilirliği ve off-site kopya yok |
| Monitoring ve alarmlar | 2,5/10 | Production için yetersiz |
| Mevcut servis kapasitesi | 7,5/10 | Şu an düşük yük |
| VitrinOS sonrası kapasite | 5,5/10 | 2 vCPU ve disk büyümesi sınır oluşturacak |

## Doğrulanmış sağlıklı kontroller

### Sistem

- Ubuntu `22.04.5 LTS`, kernel `5.15.0-186`.
- Bekleyen paket güncellemesi yok.
- Reboot gereksinimi yok.
- Otomatik güncelleme etkin ve aktif.
- Sistem saati senkronize, NTP aktif.
- Son 30 günde OOM kaydı yok.
- Failed systemd unit görünmüyor.
- 2 vCPU, 7,8 GiB RAM ve 2 GiB swap mevcut.
- Yaklaşık 5,9 GiB kullanılabilir RAM var.
- Disk 99 GiB; yaklaşık 60 GiB boş, kullanım %38.
- Inode kullanımı %23.

### SSH

Etkin `sshd -T` sonucu güvenli:

```text
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
X11Forwarding no
AllowUsers locko-admin
```

- `locko-admin` root olmayan yönetici kullanıcıdır.
- Kullanıcı `sudo` grubundadır fakat parola gerekmektedir.
- Docker grubunda kullanıcı yoktur.
- `~/.ssh` izni `700`, `authorized_keys` izni `600`.
- İki authorized key kaydı bulunmaktadır.

### Firewall ve saldırı yüzeyi

- UFW aktif.
- Varsayılan gelen trafik: `deny`.
- Varsayılan routed trafik: `deny`.
- İzinli portlar yalnızca `22`, `80`, `443` ve IPv6 karşılıklarıdır.
- Dışarıdan yayınlanan Docker portları yalnızca Traefik `80/443` portlarıdır.
- PostgreSQL `5432`, Redis `6379`, n8n `5678` ve Chatwoot `3000` host üzerinde yayınlanmamaktadır.
- Fail2ban `sshd` jail aktif; kontrol anında 70 IP engellenmişti.
- Son 24 saatte 1.735 başarısız/geçersiz SSH denemesi görülmüştür. Bu, public SSH portunun sürekli tarandığını gösterir; mevcut key-only politika nedeniyle doğrudan ihlal kanıtı değildir.

### TLS ve n8n erişimi

- HTTP isteği HTTPS'e `301` ile yönleniyor.
- `https://server.n8n-mustafa.me/` ve `/healthz` `200` döndürüyor.
- TLS 1.0 ve 1.1 reddediliyor.
- TLS 1.2 ve 1.3 kabul ediliyor.
- HSTS, `X-Content-Type-Options`, `Referrer-Policy` ve `Permissions-Policy` mevcut.
- Sertifika Let's Encrypt tarafından verilmiş ve 22 Ağustos 2026 tarihinde sona eriyor.
- `n8n-ssl-renew` cron dosyası mevcut; son başarılı otomatik yenileme ayrıca kanıtlanmalıdır.

### Docker ve uygulamalar

- Docker `29.6.2`, Compose `v5.3.1`.
- Traefik `v3.7.8` ve n8n `2.30.7` healthcheck sonucu sağlıklı.
- Chatwoot `v4.14.0` çalışıyor.
- Container restart sayıları sıfır.
- Tüm container'larda `privileged=false`.
- n8n `node` kullanıcısıyla çalışıyor.
- n8n execution pruning değişkenleri tanımlı.
- n8n encryption key değişkeni tanımlı; değer incelenmemiştir.
- Docker socket normal kullanıcıya açık değildir.

## Kritik ve riskli alanlar

## P0 — Production öncesi zorunlu

### P0.1 — Chatwoot `.env` dosyası yerel kullanıcılara okunabilir

**Kanıt:**

```text
-rw-r--r-- root root /opt/chatwoot/.env
drwxr-xr-x root root /opt/chatwoot
```

**Risk:** Sunucuda shell erişimi elde eden düşük yetkili bir hesap Chatwoot database parolalarını, uygulama secret'larını veya üçüncü taraf anahtarlarını okuyabilir.

**Düzeltme:** Dosya en az `root:root 600`, dizin gereksinime göre `750` veya daha sıkı olmalıdır. Compose servislerinin dosyayı host üzerinden okuma ihtiyacı doğrulanarak izin değiştirilmelidir. Aynı risk için diğer `.env`, credential ve backup dosyaları taranmalıdır.

**Ek önlem:** Sunucuda geçmişte güvenilmeyen yerel kullanıcı bulunmuşsa veya dosyanın okunduğuna dair şüphe varsa ilgili secret'lar döndürülmelidir.

### P0.2 — `/home/n8n_depo` herkese yazılabilir

**Kanıt:**

```text
drwxrwxrwx root root /home/n8n_depo
```

**Risk:** Herhangi bir yerel kullanıcı veya düşük yetkili servis buraya dosya ekleyebilir/değiştirebilir. n8n bu dosyaları işliyorsa kod, veri veya workflow manipülasyonu mümkün olabilir.

**Düzeltme:** Önce bu dizini hangi UID/GID ve container'ın kullandığı doğrulanmalı; ardından doğru sahiplik verilerek izin `750`, `770` veya kullanım modeline göre daha sıkı hale getirilmelidir. Körlemesine `chmod` uygulanmamalıdır.

### P0.3 — Yedekler world-readable ve yalnızca aynı sunucuda

**Kanıt:** n8n ve günlük uygulama yedeklerinin izinleri `644`; yedekler `/var/backups` ve `/opt/n8n-backups` altında aynı diskte tutuluyor.

**Risk:** Yedekler n8n credential verisi veya encryption key içeriyorsa yerel kullanıcılar tarafından okunabilir. Aynı disk arızası, fidye yazılımı, yanlış silme veya sunucu kaybı hem production verisini hem yedeği yok eder.

**Düzeltme:**

- Yedek dosyaları `600`, yedek dizinleri `700/750` yapılmalı.
- Şifreli off-site backup kurulmalı.
- Backup parolası sunucudaki arşivin yanında tutulmamalı.
- Günlük/haftalık/aylık retention uygulanmalı.
- Restore testi düzenli otomasyona bağlanmalı.

### P0.4 — Chatwoot PostgreSQL dump'ları geçerlilik açısından şüpheli

**Kanıt:** Canlı Chatwoot database boyutu yaklaşık `7.439 kB`; günlük `.dump` dosyalarının her biri yalnızca `877` bayt.

**Risk:** Dump komutu hata çıktısını dosyaya yazıyor veya boş/eksik database yedekliyor olabilir. Dosyanın mevcut olması başarılı backup anlamına gelmez.

**Düzeltme ve kabul kriteri:**

1. `file` ile dump formatı doğrulanmalı.
2. Custom format ise `pg_restore --list` hatasız çalışmalı.
3. Ayrı geçici PostgreSQL instance'ına restore edilmeli.
4. Kritik tablo sayıları ve yaklaşık kayıt sayıları production ile karşılaştırılmalı.
5. Backup scripti dump başarısızsa non-zero exit vermeli ve eski dosya başarılıymış gibi tutulmamalı.

## P1 — Production açılmadan tamamlanmalı

### P1.1 — `vitrinos-backup` servis hatası

**Kanıt:** Journal kaydında `Failed to start /usr/local/sbin/vitrinos-backup` bulunuyor.

**Risk:** VitrinOS kurulmadan önce hazırlanmış backup zinciri güvenilir değil veya eksik yapılandırılmış.

**Düzeltme:** Unit/script hata kodu, dependency, izin, hedef dizin ve loglama incelenmeli. Servis manuel testte başarılı olmadan timer etkin kabul edilmemeli.

### P1.2 — CPU, RAM ve PID limitleri yok

**Kanıt:** Tüm container'larda `memory=0`, `nanoCpus=0`, `pids=<no value>`.

**Risk:** n8n Code/Jimp işlemi, Chatwoot Sidekiq veya hatalı bir process tüm RAM/CPU'yu tüketerek aynı sunucudaki bütün servisleri durdurabilir.

**Başlangıç planı:** Ölçüm ve yük testinden sonra Compose security override dosyalarına memory, CPU ve PID limitleri eklenmelidir. Başlangıç bütçesi aşağıdaki gibi değerlendirilebilir; doğrudan uygulama değeri değildir:

| Servis | Başlangıç memory üst sınırı | Başlangıç CPU payı |
|---|---:|---:|
| Traefik | 256 MiB | 0,25 |
| n8n | 1,5–2 GiB | 1,0 |
| Chatwoot Rails | 1 GiB | 0,75 |
| Chatwoot Sidekiq | 1–1,5 GiB | 0,75 |
| Chatwoot PostgreSQL | 768 MiB–1 GiB | 0,5 |
| Redis | 256 MiB | 0,25 |

2 vCPU üzerinde CPU limitleri toplamı fiziksel kapasiteyi aşabilir; bu nedenle `reservation`, `limit`, eşzamanlı iş sayısı ve gerçek peak ölçümü birlikte değerlendirilmelidir.

### P1.3 — Docker ağ segmentasyonu yok

**Kanıt:** Traefik, n8n, Chatwoot, Redis ve PostgreSQL aynı `n8n-compose_default` ağına bağlı.

**Risk:** İnternete açık n8n veya Chatwoot container'larından biri ele geçirilirse Redis ve PostgreSQL'e ağ erişimi elde edilebilir.

**Düzeltme:**

- `proxy` ağı: yalnızca Traefik ve HTTP servisleri.
- `n8n-internal` ağı: n8n'in ihtiyaç duyduğu servisler.
- `chatwoot-internal` ağı: Rails, Sidekiq, Redis, PostgreSQL.
- Gelecekte `vitrinos-internal`: VitrinOS API, VitrinOS PostgreSQL ve dosya servisi.
- Internal ağlarda gereksiz container üyeliği kaldırılmalı; gerekiyorsa Docker `internal: true` kullanılmalı.

### P1.4 — Eksik healthcheck'ler

**Kanıt:** Yalnızca Traefik ve n8n healthcheck tanımlı. Rails, Sidekiq, Redis ve PostgreSQL için healthcheck yok.

**Risk:** Container `running` görünürken uygulama, worker, database veya Redis gerçekte kullanılamaz durumda olabilir.

**Düzeltme:** Servise özel ve credential sızdırmayan healthcheck'ler eklenmeli. Healthcheck sonucu external uptime kontrolüyle birlikte değerlendirilmelidir.

### P1.5 — Monitoring ve alarm sistemi yok

**Kanıt:** Prometheus exporter, Netdata, Monit, Uptime Kuma veya benzeri çalışan servis görünmedi.

**İzlenmesi gereken minimum sinyaller:**

- CPU, RAM, swap, load average.
- Disk ve inode kullanımı.
- Container health/restart sayısı.
- n8n ve gelecekte VitrinOS HTTP health endpointleri.
- TLS sona erme süresi.
- Son başarılı backup zamanı ve dosya yaşı.
- PostgreSQL backup/restore doğrulama sonucu.
- OOM ve systemd failed unit.

### P1.6 — Traefik Docker socket erişimi

**Kanıt:** Traefik container'ında Docker socket mount edilmiş.

**Risk:** Traefik container'ında ciddi bir açık oluşursa Docker API erişimi host kontrolüne kadar ilerleyebilir. Socket mount'un `read-only` olması Docker API'nin bütün risklerini ortadan kaldırmaz.

**Düzeltme:** Docker socket proxy ile yalnızca gereken read endpointlerini sunmak veya Traefik file provider kullanmak değerlendirilmelidir.

### P1.7 — Redis ve PostgreSQL'de `no-new-privileges` yok

**Kanıt:** n8n, Traefik, Rails ve Sidekiq için `no-new-privileges:true`; Redis ve PostgreSQL için tanımlı değil.

**Düzeltme:** Image uyumluluğu staging üzerinde doğrulandıktan sonra security option eklenmeli; gerekirse capability azaltma ve explicit user uygulanmalıdır.

## P2 — Kısa vadeli iyileştirmeler

### P2.1 — Mutable/geniş image tag'leri

- `redis:alpine` mutable bir tag'dir.
- `pgvector/pgvector:pg15` geniş major tag'dir.

Production'da doğrulanmış patch tag veya digest pinleme, kontrollü güncelleme ve rollback politikası uygulanmalıdır.

### P2.2 — Read-only root filesystem ve capability azaltma yok

Tüm container'larda `readonly=false`, `capDrop=null`. Her image doğrudan read-only çalışmayabilir; yazılması gereken dizinler volume/tmpfs olarak ayrılıp uyumluluk testi yapılmalıdır. En azından gereksiz Linux capability'leri düşürülmelidir.

### P2.3 — HTTP güvenlik başlıkları tamamlanabilir

Doğrulanan yanıtta CSP ve açık bir `frame-ancestors`/`X-Frame-Options` politikası görünmedi. n8n arayüzünün ihtiyaçları test edilerek clickjacking ve script kaynak politikaları sıkılaştırılmalıdır.

### P2.4 — SSH sürekli internet taramasına açık

Key-only SSH politikası güçlüdür; buna rağmen 24 saatte 1.735 başarısız deneme oluşmuştur. Sabit yönetim IP'si, sağlayıcı firewall'u, VPN/Tailscale veya port knocking gibi ek ağ kısıtları değerlendirilmelidir. Yalnızca SSH portunu değiştirmek temel güvenlik kontrolü sayılmamalıdır.

### P2.5 — Disk büyüme politikası gerekli

- Docker image kullanımı 21,03 GB.
- Build cache 3,37 GB.
- Yaklaşık 10,7 GB reclaimable veri var.
- VitrinOS görselleri, database, loglar ve yerel backup'lar aynı 100 GB diski paylaşacak.

Disk alarmı `%70` uyarı, `%80` kritik seviyede kurulmalı. Reclaim işlemleri otomatik ve körlemesine yapılmamalı; önce hedefler doğrulanmalıdır.

## Kapasite değerlendirmesi

### Mevcut kullanım

Kontrol anındaki container bellek toplamı yaklaşık 1,45 GiB'dir; host seviyesinde yaklaşık 5,9 GiB kullanılabilir bellek bulunmaktadır. CPU yükü düşüktür. Mevcut servisler için anlık kapasite rahattır.

### VitrinOS için karar

Mevcut 2 vCPU/8 GB sunucu şu koşullarda ilk düşük trafikli VitrinOS sürümünü çalıştırabilir:

- VitrinOS API hafif ve stateless tutulur.
- Ayrı VitrinOS PostgreSQL container'ına limit uygulanır.
- Büyük görsel işleme concurrency'si sınırlandırılır.
- Dosya retention/cleanup politikası bulunur.
- Off-site backup kurulur.
- Disk ve RAM alarmları aktif olur.
- Gerçek staging yük testi geçilir.

Orta trafik, yoğun Jimp/image processing veya büyüyen görsel arşivi için önerilen hedef en az **4 vCPU, 16 GB RAM ve 200 GB SSD/NVMe** ya da VitrinOS'un ayrı bir sunucuya ayrılmasıdır. Tek sunucuda n8n, Chatwoot ve VitrinOS bulunması ortak hata alanı yaratır.

## Doğrulanamayan noktalar

Aşağıdakiler için mevcut çıktılar kesin kanıt sağlamamaktadır:

- Sağlayıcı/cloud firewall politikası.
- Off-site backup hedefi ve şifrelemesi.
- Gerçek restore testi sonucu.
- Root backup cron içeriğinin doğru exit-code ve hata bildirimi davranışı.
- `n8n-ssl-renew` cron işinin son başarılı çalışması.
- Traefik Docker socket mount'unun host tarafındaki ayrıntılı erişim modeli.
- Provider snapshot politikası.
- Disk IOPS ve gerçek network bant genişliği.
- VitrinOS beklenen trafik, görsel boyutu ve eşzamanlı job sayısı.
- Uygulama seviyesi güvenlik/yük testleri.

## Önerilen uygulama sırası

1. Chatwoot `.env`, n8n backup ve backup dizin izinlerini düzelt.
2. `/home/n8n_depo` gerçek kullanıcısını doğrula ve `777` iznini kaldır.
3. Chatwoot dump dosyasını `pg_restore --list` ve geçici restore ile doğrula.
4. `vitrinos-backup` service hatasını düzelt; başarısız backup alarmı ekle.
5. Şifreli off-site backup ve retention kur.
6. Gerçek restore provası yap ve runbook oluştur.
7. Hafif monitoring/uptime/backup-age alarmlarını kur.
8. Docker ağlarını servis bazında ayır.
9. Healthcheck, memory/CPU/PID limitleri ekle.
10. Traefik Docker socket proxy veya file provider'a geçişi değerlendir.
11. Redis/PostgreSQL security options ve image pinlemeyi tamamla.
12. VitrinOS staging stack'ini kur; yük, kesinti ve reboot testi yap.
13. P0/P1 kabul kriterleri geçtikten sonra production DNS trafiğini aç.

## Production onay kapısı

VitrinOS production yayını için aşağıdakilerin tamamı geçmelidir:

- [ ] Hassas `.env` ve backup dosyaları yalnızca yetkili kullanıcılarca okunabiliyor.
- [ ] World-writable uygulama dizini kalmadı.
- [ ] Chatwoot PostgreSQL restore testi başarılı.
- [ ] n8n restore testi başarılı.
- [ ] VitrinOS backup service başarılı ve alarm üretiyor.
- [ ] Şifreli off-site backup mevcut.
- [ ] Disk/RAM/container/TLS/backup alarmları çalışıyor.
- [ ] Docker ağ segmentasyonu tamamlandı.
- [ ] Kritik container healthcheck'leri mevcut.
- [ ] Resource ve PID limitleri staging testinden geçti.
- [ ] VitrinOS PostgreSQL/Redis host portları internete kapalı.
- [ ] VitrinOS API authorization ve dosya erişim testleri geçti.
- [ ] Staging yük testi ve reboot sonrası otomatik toparlanma testi başarılı.
- [ ] Rollback ve restore runbook'u uygulamalı olarak doğrulandı.

## Hedef puan

- Mevcut durum: **6,4/10**
- P0 maddeleri tamamlanınca beklenen: **7,3/10**
- P0 + P1 tamamlanınca beklenen: **8,5/10**
- Ayrı VitrinOS sunucusu veya 4 vCPU/16 GB yükseltme, düzenli restore testi ve tam gözlemlenebilirlikle: **9+/10**

