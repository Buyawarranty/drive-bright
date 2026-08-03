ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS msclkid text,
  ADD COLUMN IF NOT EXISTS is_bing_ads boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_page_views_is_bing_ads ON public.page_views (is_bing_ads, created_at DESC);