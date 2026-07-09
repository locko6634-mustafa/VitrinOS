-- Migration: Supabase brand_prompts tablosundaki n8n expression ifadelerini
-- <<PLACEHOLDER>> formatina donusturme
-- Sorun: n8n Expression motoru tek seviye cozumleme yapiyor,
-- ic ice gecmis {{ }} ifadeleri ham string olarak kaliyor.
-- Cozum: Expression'lari <<PLACEHOLDER>> formatina donustur,
-- n8n Code dugumu ile replace yap.

UPDATE brand_prompts SET

  -- 1. revize_prompt: REVIZE workflow icin
  revize_prompt = REPLACE(REPLACE(REPLACE(REPLACE(
    revize_prompt,
    '{{ $(''Baslangic_Verilerini_Ayarla'').item.json[''revizyon mesaj''] }}', '<<REVISION_REQUEST>>'),
    '{{ $(''Baslangic_Verilerini_Ayarla'').item.json[''orjinal brief''] }}', '<<ORIGINAL_BRIEF>>'),
    '{{ $(''Baslangic_Verilerini_Ayarla'').item.json.intent }}', '<<FORMAT>>'),
    '{{ $(''Baslangic_Verilerini_Ayarla'').item.json[''revizyon sayısı''] }}', '<<REVISION_COUNT>>'),

  -- 2. story_bg_prompt
  story_bg_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    story_bg_prompt,
    '{{ $json.logoPosition }}', '<<LOGO_POSITION>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),
    '{{ $json.title }}', '<<TITLE>>'),

  -- 3. story_img_prompt
  story_img_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    story_img_prompt,
    '{{ $json.title }}', '<<TITLE>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),

  -- 4. meta_post_bg_prompt
  meta_post_bg_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    meta_post_bg_prompt,
    '{{ $json.logoPosition }}', '<<LOGO_POSITION>>'),
    '{{ $json.title }}', '<<TITLE>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),

  -- 5. meta_post_img_prompt
  meta_post_img_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    meta_post_img_prompt,
    '{{ $json.logoPosition }}', '<<LOGO_POSITION>>'),
    '{{ $json.title }}', '<<TITLE>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),

  -- 6. banner_bg_prompt
  banner_bg_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    banner_bg_prompt,
    '{{ $json.width }}', '<<WIDTH>>'),
    '{{ $json.height }}', '<<HEIGHT>>'),
    '{{ $json.textPosition }}', '<<TEXT_POSITION>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),

  -- 7. banner_img_prompt
  banner_img_prompt = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    banner_img_prompt,
    '{{ $json.width }}', '<<WIDTH>>'),
    '{{ $json.height }}', '<<HEIGHT>>'),
    '{{ $json.textPosition }}', '<<TEXT_POSITION>>'),
    '{{ $json.colorTheme }}', '<<COLOR_THEME>>'),
    '{{ $json.title }}', '<<TITLE>>'),
    '{{ $json.theme }}', '<<THEME>>'),
    '{{ $json.slogan }}', '<<SLOGAN>>'),
    '{{ $json.product_name }}', '<<PRODUCT_NAME>>'),
    '{{ $json.category }}', '<<CATEGORY>>'),
    '{{ $json.subject }}', '<<SUBJECT>>'),
    '{{ $json.discount_rate }}', '<<DISCOUNT_RATE>>'),
    '{{ $json.new_price }}', '<<NEW_PRICE>>'),
    '{{ $json.old_price }}', '<<OLD_PRICE>>'),
    '{{ $json.campaign_code }}', '<<CAMPAIGN_CODE>>');
