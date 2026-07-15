# Restore drill planı

Amaç: Supabase verisi, Storage görselleri ve n8n workflow export'larının geri yüklenebilir olduğunu kanıtlamak.

## Hedefler

- RPO: en fazla 24 saatlik veri kaybı.
- RTO: kritik akışın 60 dakika içinde yeniden çalışması.
- Başarı kriteri: sentetik brief tamamlanır, görsel Storage'tan okunur, `jobs` kaydı `completed` olur ve correlation ID uçtan uca korunur.

## Kontrollü tatbikat

1. Production verisine dokunmayan Supabase branch veya izole restore ortamı oluşturun.
2. Şema/migration listesini, seçili `brands`, `brand_prompts`, `jobs` satırlarını ve `generated-assets` test objesini kanıt olarak alın.
3. n8n workflow export'larını ve credential isimlerini (secret değerlerini değil) geri yükleme paketine koyun.
4. Restore işlemini çalıştırın; saat, sorumlu ve kullanılan snapshot ID'sini kaydedin.
5. RLS, Storage erişimi, Edge Function auth ve n8n webhook secret kontrollerini yapın.
6. Sentetik brief gönderin. Hata olursa gerçek müşteri verisi kullanmadan Error Trigger ve alarm akışını doğrulayın.
7. RPO/RTO ölçümünü, eksik obje/row listesini ve rollback kararını kaydedin.

## Kanıt ve takip

- Restore başlangıç/bitiş zamanları.
- Snapshot veya branch kimliği.
- CI commit SHA ve n8n export checksum'i.
- Sentetik `jobId`, correlation ID ve execution ID.
- Başarı kriteri sonucu: geçti/kaldı ve ekran görüntüsü veya log bağlantısı.
- Bulgu, sorumlu, son tarih ve yeniden test tarihi.

Tatbikat production üzerinde ilk kez yapılmaz. Başarısız tatbikat sonrası canlı workflow veya migration değişikliği uygulanmadan önce bulgu triage edilmelidir.
