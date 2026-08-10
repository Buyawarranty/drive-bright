ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'tiktok_ad';
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS ttclid text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS is_tiktok_ads boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_page_views_is_tiktok_ads ON public.page_views (is_tiktok_ads, created_at DESC);