
-- Track which conversions have been uploaded to Google Ads
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS google_ads_conversion_uploaded_at TIMESTAMPTZ;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS google_ads_conversion_status TEXT DEFAULT NULL;

-- Also track on bumper_transactions
ALTER TABLE public.bumper_transactions ADD COLUMN IF NOT EXISTS google_ads_conversion_uploaded_at TIMESTAMPTZ;
ALTER TABLE public.bumper_transactions ADD COLUMN IF NOT EXISTS google_ads_conversion_status TEXT DEFAULT NULL;

-- Index for efficient querying of pending conversions
CREATE INDEX IF NOT EXISTS idx_customers_gclid_pending ON public.customers (gclid) 
  WHERE gclid IS NOT NULL AND google_ads_conversion_uploaded_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_bumper_gclid_pending ON public.bumper_transactions (gclid)
  WHERE gclid IS NOT NULL AND google_ads_conversion_uploaded_at IS NULL AND status = 'completed';
