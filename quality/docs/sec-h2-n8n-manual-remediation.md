# SEC-H2 — n8n manuel düzeltme yönergesi

Bu yönerge yalnızca n8n arayüzünde uygulanacak değişiklikleri kapsar. Workflow’lar MCP ile okunmuş ve aşağıdaki düğüm/alan adları canlı yapıdan doğrulanmıştır.

## 1. Ana workflow: `VitrinOS_BASE`

`Brief_Detaylarini_Normalize_Et` Code düğümünde:

- LLM çıktısından `details.image_url` okumayı kaldırın.
- `structuredOutput.visual_details.image_url` değerini boş string yapın veya alanı kaldırın.
- Normalize edilen çıktıya şu alanı ekleyin:

```js
source_image_path: String(
  $('Brief_Tetikleyici').item.json.body.sourceImagePath || ''
).trim(),
```

- Normalize çıktısındaki `image_url` alanını kaldırın. Eski `image_url` adı dış URL taşıyabilecek tek alan olduğu için yeniden kullanmayın.

`Call_VitrinOS_META_POST`, `Call_VitrinOS_STORY` ve `Call_VitrinOS_BANNER` düğümlerinin `Workflow Inputs` eşlemelerinde:

- `image_url` alanını silin.
- Şu alanı ekleyin:

```text
source_image_path = {{ $json.source_image_path }}
```

Her üç düğümdeki input schema listesinden de `image_url` satırını silip `source_image_path` satırını string olarak ekleyin.

## 2. Alt workflow’lar

Şu üç workflow’un her birinde aynı işlemleri yapın:

- `VitrinOS_META_POST` — `TjIBuLmyigpNjBnV`
- `VitrinOS_STORY` — `36iRYjVaLyqIdo6z`
- `VitrinOS_BANNER` — `gjzjuE91iiU2Ew0G`

### `When Executed by Another Workflow`

Workflow input listesinden `image_url` alanını kaldırın, yerine `source_image_path` alanını ekleyin.

### `Baslangic_Verilerini_Ayarla`

Mevcut assignment:

```text
image_url = {{ $json.image_url }}
```

şu hale gelmeli:

```text
source_image_path = {{ $json.source_image_path }}
```

### `Parse_Metin_JSON`

Code içindeki `image_url: ...` assignment’ını kaldırın; gerekiyorsa aynı değeri şu adla taşıyın:

```js
source_image_path: $('Baslangic_Verilerini_Ayarla').item.json.source_image_path
```

### `IF_Image_URL_Var_mi`

Koşulun sol değerini şu ifadeyle değiştirin:

```text
{{ $json.source_image_path }}
```

Operation `notEmpty` olarak kalmalı.

### `HTTP_Urun_Gorseli_Indir`

Üç workflow’da da ayarlar:

- URL:

```text
=https://wrzalebhnlwppufdcmiz.supabase.co/storage/v1/object/authenticated/source-assets/{{ $json.source_image_path }}
```

- Authentication: `Predefined Credential Type`
- Credential type: mevcut `supabaseApi`
- Response format: `File`
- Output property name: `product_image`
- Follow redirects: `false`
- Timeout: `10000` ms

Bucket zaten 10 MB ve PNG/JPEG/WebP ile sınırlanacağı için HTTP düğümünde dış URL boyut kontrolü yerine yalnızca bu Storage endpoint’i kullanılmalıdır. URL alanına hiçbir zaman `$json.briefText`, LLM çıktısı veya kullanıcı tarafından yazılabilen bir URL bağlamayın.

## 3. Kaydetme ve kontrol

Her workflow’u kaydedin, ardından canlı workflow’u pasif edip tekrar aktif edin. İlk testte:

- Görsel olmadan brief gönderin: HTTP düğümü çalışmamalı.
- PNG/JPEG/WebP görsel ile brief gönderin: URL `source-assets/<user-id>/<uuid>.<ext>` biçiminde olmalı.
- Brief içine `http://127.0.0.1`, `http://169.254.169.254` veya harici bir URL yazın: hiçbir HTTP düğümü bu URL’ye istek yapmamalı.
- 10 MB üstü veya MIME/magic-byte uyumsuz dosya Edge Function tarafından reddedilmeli.

MCP ile son kontrol için `get_workflow_details` kullanılarak üç workflow’da şu şartlar doğrulanmalıdır:

- `HTTP_Urun_Gorseli_Indir` URL’si yalnızca `source-assets` authenticated endpoint’ine gidiyor.
- `image_url` alanı üç alt workflow’un inputlarında ve HTTP URL’lerinde yok.
- `source_image_path` ana workflow’dan üç alt workflow’a taşınıyor.

Doğrudan workflow güncellemesi yapılmadı; bu proje için n8n değişiklikleri arayüzden uygulanmalıdır.
