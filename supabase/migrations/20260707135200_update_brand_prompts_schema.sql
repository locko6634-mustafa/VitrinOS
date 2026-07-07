-- Eski prompt alanlarını kaldır
ALTER TABLE public.brand_prompts 
  DROP COLUMN IF EXISTS banner_prompt,
  DROP COLUMN IF EXISTS meta_post_prompt,
  DROP COLUMN IF EXISTS story_prompt;

-- Her workflow'un her agent'ı için yeni prompt alanları ekle
ALTER TABLE public.brand_prompts
  ADD COLUMN IF NOT EXISTS story_text_prompt text,
  ADD COLUMN IF NOT EXISTS story_bg_prompt text,
  ADD COLUMN IF NOT EXISTS story_img_prompt text,
  ADD COLUMN IF NOT EXISTS banner_text_prompt text,
  ADD COLUMN IF NOT EXISTS banner_bg_prompt text,
  ADD COLUMN IF NOT EXISTS banner_img_prompt text,
  ADD COLUMN IF NOT EXISTS meta_post_text_prompt text,
  ADD COLUMN IF NOT EXISTS meta_post_bg_prompt text,
  ADD COLUMN IF NOT EXISTS meta_post_img_prompt text;
