ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS quoted_claim_limit integer,
  ADD COLUMN IF NOT EXISTS quoted_labour_rate integer,
  ADD COLUMN IF NOT EXISTS quoted_excess integer,
  ADD COLUMN IF NOT EXISTS quoted_term text,
  ADD COLUMN IF NOT EXISTS quoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS quote_source text;

CREATE INDEX IF NOT EXISTS idx_sales_leads_quote_amount ON public.sales_leads (quote_amount) WHERE quote_amount IS NOT NULL;

-- Website pricing page (Step 3) -> lead
CREATE OR REPLACE FUNCTION public.sync_lead_quote_from_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_price IS NULL OR NEW.total_price <= 0 THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads sl
     SET quote_amount = NEW.total_price,
         cart_value = NEW.total_price,
         quoted_claim_limit = COALESCE(NEW.claim_limit, sl.quoted_claim_limit),
         quoted_labour_rate = COALESCE(NEW.labour_rate, sl.quoted_labour_rate),
         quoted_excess = COALESCE(NEW.voluntary_excess, sl.quoted_excess),
         quoted_term = COALESCE(NEW.payment_type, sl.quoted_term),
         quoted_at = now(),
         quote_source = 'website_step3'
   WHERE (sl.abandoned_cart_id = NEW.id
          OR (NEW.email IS NOT NULL AND lower(sl.email) = lower(NEW.email)))
     AND COALESCE(sl.quote_amount, -1) <> NEW.total_price;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_quote_from_cart ON public.abandoned_carts;
CREATE TRIGGER trg_sync_lead_quote_from_cart
AFTER INSERT OR UPDATE OF total_price, claim_limit, labour_rate, voluntary_excess, payment_type
ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_quote_from_cart();

-- Agent-sent quote -> lead
CREATE OR REPLACE FUNCTION public.sync_lead_quote_from_sent_quote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.total_price IS NULL OR NEW.total_price <= 0 OR NEW.customer_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads sl
     SET quote_amount = NEW.total_price,
         quoted_claim_limit = COALESCE(NULLIF(regexp_replace(COALESCE(NEW.claim_limit::text,''), '[^0-9]', '', 'g'), '')::integer, sl.quoted_claim_limit),
         quoted_labour_rate = COALESCE(NULLIF(regexp_replace(COALESCE(NEW.labour_rate::text,''), '[^0-9]', '', 'g'), '')::integer, sl.quoted_labour_rate),
         quoted_excess = COALESCE(NULLIF(regexp_replace(COALESCE(NEW.excess_amount::text,''), '[^0-9]', '', 'g'), '')::integer, sl.quoted_excess),
         quoted_term = COALESCE(NEW.payment_type, sl.quoted_term),
         quoted_at = now(),
         quote_source = 'agent_quote'
   WHERE lower(sl.email) = lower(NEW.customer_email);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_quote_from_sent_quote ON public.admin_sent_quotes;
CREATE TRIGGER trg_sync_lead_quote_from_sent_quote
AFTER INSERT ON public.admin_sent_quotes
FOR EACH ROW EXECUTE FUNCTION public.sync_lead_quote_from_sent_quote();