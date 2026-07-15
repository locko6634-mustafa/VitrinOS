# VitrinOS operasyonel dayanıklılık runbook'u

Bu belge, canlı n8n ve Supabase değişiklikleri için manuel uygulama sözleşmesidir. n8n workflowları MCP veya API ile doğrudan değiştirilmez; değişiklikler n8n arayüzünde incelenip onaylandıktan sonra uygulanır.

## Mevcut canlı bulgular (15 Temmuz 2026)

- `VitrinOS_BASE` içinde `Error Trigger` ve başarısız işi `jobs.status=failed` yapan akış var.
- Canlı workflow snapshot'ında `retryOnFail`, `maxTries`, `waitBetweenTries` ve node timeout ayarı yok.
- Ayrı bir alarm/notification workflowu görünmüyor.
- Supabase retention cron'u yalnızca `lead_submission_attempts` tablosunu 30 gün tutuyor; `jobs` ve Storage için retention politikası doğrulanmadı.
- Supabase security advisor: leaked password protection kapalı uyarısı mevcut.

## n8n değişiklik sırası

1. `VitrinOS_BASE` ve dört alt workflowun JSON export'unu alın; export'u release kanıtı olarak saklayın.
2. Dış servis çağrılarında retry açın: en fazla 3 deneme, exponential backoff, yalnızca geçici HTTP/429/5xx hatalarında.
3. HTTP Request, Execute Workflow ve görüntü üretim düğümlerine açık timeout ekleyin. Önerilen başlangıç sınırları: webhook orchestration 30 sn, Supabase 10 sn, görüntü üretimi 180 sn.
4. Retry sonunda Error Trigger'a düşen kaydı tekilleştirin. `jobId` ve `correlationId` ile aynı hata için ikinci kez alarm üretmeyin.
5. Error Trigger akışını ayrı bir `VitrinOS_OPS_ALERT` workflowuna bağlayın. Alarm payload'ı: workflow adı, node adı, jobId, correlation ID, execution ID, hata sınıfı, ilk/son görülme zamanı.
6. Alarm kanalında PII, secret, prompt ve görsel URL'sini maskeleyin. Alarm gönderimi başarısız olursa hata kaydı yine `jobs` veya ayrı güvenli ops tablosuna yazılmalı.
7. n8n execution retention'ı production için belirleyin: başarılı çalıştırmalar 7 gün, başarısız çalıştırmalar 30 gün; export ve alarm kanıtları ayrı tutulmalı.
8. Her değişiklikten sonra önce workflow validation, sonra tek bir sentetik brief ve bir kontrollü hata senaryosu çalıştırın.

## Supabase retention ve alarm kontrolleri

- `lead_submission_attempts` cleanup cron'unu günlük çalıştırıp son çalıştırma zamanını gözlemleyin.
- `jobs` için iş yaşam döngüsü retention'ı ayrıca tanımlanmadan otomatik silme uygulamayın; müşteri teslim geçmişi ve yasal saklama ihtiyacı netleşmeli.
- Storage `generated-assets` için yaşam süresi, silme yetkisi ve geri yükleme kaynağı belgelenmeli.
- Leaked password protection ayarı Supabase Dashboard > Authentication > Password Security bölümünde açılmalı; bu canlı değişiklik kullanıcı onayıyla yapılmalıdır.

## Alarm eşikleri

- 5 dakikada 3+ failed job: yüksek öncelik.
- Aynı `workflow + node + error class` için 10 dakikada 5+ hata: kritik öncelik.
- 15 dakikadan uzun `processing` job: stuck-job alarmı.
- Retention cron iki ardışık çalışmada başarısız: orta öncelik.

Her alarmda correlation ID zorunludur; dashboard destek mesajı bu ID ile aranabilir olmalıdır.
