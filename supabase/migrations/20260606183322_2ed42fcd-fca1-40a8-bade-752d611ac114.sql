ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS utm_content  text;

CREATE INDEX IF NOT EXISTS idx_customers_utm_campaign ON public.customers (utm_campaign) WHERE utm_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_utm_source   ON public.customers (utm_source)   WHERE utm_source   IS NOT NULL;