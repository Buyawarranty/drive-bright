ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS fbclid text;
ALTER TABLE public.page_views ADD COLUMN IF NOT EXISTS is_facebook_ads boolean DEFAULT false;