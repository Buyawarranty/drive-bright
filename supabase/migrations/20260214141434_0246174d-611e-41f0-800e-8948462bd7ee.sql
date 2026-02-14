
-- Add gclid and ga_client_id columns to customers table for Google Ads attribution tracking
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gclid text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ga_client_id text;

-- Add index for querying customers by gclid
CREATE INDEX IF NOT EXISTS idx_customers_gclid ON public.customers (gclid) WHERE gclid IS NOT NULL;
