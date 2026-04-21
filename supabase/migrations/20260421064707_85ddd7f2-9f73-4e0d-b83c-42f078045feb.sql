
-- 1. Add acquisition_source column to customers
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

CREATE INDEX IF NOT EXISTS idx_customers_acquisition_source
  ON public.customers(acquisition_source);

COMMENT ON COLUMN public.customers.acquisition_source IS
  'Marketing channel that brought the customer (google_ads, facebook_ads, website/organic). Sourced from sales_leads.lead_source. Distinct from purchase_source which records the payment method.';

-- 2. Backfill from sales_leads (most recent matching lead per customer email)
WITH ranked_leads AS (
  SELECT
    LOWER(email) AS email_lc,
    lead_source::text AS lead_source,
    ROW_NUMBER() OVER (PARTITION BY LOWER(email) ORDER BY created_at DESC) AS rn
  FROM public.sales_leads
  WHERE email IS NOT NULL
)
UPDATE public.customers c
SET acquisition_source = CASE
    WHEN rl.lead_source = 'google_ad'  THEN 'google_ads'
    WHEN rl.lead_source = 'social_ad'  THEN 'facebook_ads'
    WHEN rl.lead_source = 'website'    THEN 'website'
    ELSE rl.lead_source
  END
FROM ranked_leads rl
WHERE rl.rn = 1
  AND rl.email_lc = LOWER(c.email)
  AND c.acquisition_source IS NULL;

-- 3. Also respect existing gclid: if a customer has a gclid, force google_ads
UPDATE public.customers
SET acquisition_source = 'google_ads'
WHERE gclid IS NOT NULL AND gclid <> ''
  AND (acquisition_source IS NULL OR acquisition_source = 'website');

-- 4. Trigger: when a new customer is created, auto-populate acquisition_source from sales_leads
CREATE OR REPLACE FUNCTION public.set_customer_acquisition_source()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_source TEXT;
BEGIN
  -- Skip if already set
  IF NEW.acquisition_source IS NOT NULL AND NEW.acquisition_source <> '' THEN
    RETURN NEW;
  END IF;

  -- gclid wins
  IF NEW.gclid IS NOT NULL AND NEW.gclid <> '' THEN
    NEW.acquisition_source := 'google_ads';
    RETURN NEW;
  END IF;

  -- Look up most recent matching lead by email
  SELECT lead_source::text INTO v_lead_source
  FROM public.sales_leads
  WHERE LOWER(email) = LOWER(NEW.email)
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_source IS NOT NULL THEN
    NEW.acquisition_source := CASE
      WHEN v_lead_source = 'google_ad' THEN 'google_ads'
      WHEN v_lead_source = 'social_ad' THEN 'facebook_ads'
      WHEN v_lead_source = 'website'   THEN 'website'
      ELSE v_lead_source
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_customer_acquisition_source ON public.customers;
CREATE TRIGGER trg_set_customer_acquisition_source
BEFORE INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.set_customer_acquisition_source();
