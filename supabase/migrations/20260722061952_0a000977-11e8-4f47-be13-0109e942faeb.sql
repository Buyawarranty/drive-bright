
CREATE OR REPLACE FUNCTION public.normalize_phone_uk(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE digits text;
BEGIN
  IF p IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(p, '\D', '', 'g');
  IF digits = '' THEN RETURN NULL; END IF;
  IF left(digits, 2) = '00' THEN digits := substr(digits, 3); END IF;
  IF left(digits, 2) = '44' AND length(digits) >= 11 THEN
    digits := '0' || substr(digits, 3);
  END IF;
  IF length(digits) = 10 AND left(digits,1) <> '0' THEN
    digits := '0' || digits;
  END IF;
  RETURN digits;
END;
$$;

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS phone_normalized text;

CREATE INDEX IF NOT EXISTS sales_leads_phone_normalized_idx
  ON public.sales_leads (phone_normalized);

CREATE TABLE IF NOT EXISTS public.lead_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL UNIQUE,
  phone_original text,
  attempt_count int NOT NULL DEFAULT 0,
  next_eligible_at timestamptz,
  lock_owner uuid,
  lock_until timestamptz,
  contacted_owner uuid,
  contacted_at timestamptz,
  do_not_call boolean NOT NULL DEFAULT false,
  do_not_call_reason text,
  do_not_call_at timestamptz,
  callback_at timestamptz,
  dormant boolean NOT NULL DEFAULT false,
  dormant_at timestamptz,
  last_attempt_at timestamptz,
  last_call_start timestamptz,
  last_call_end timestamptz,
  last_call_outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_customers TO authenticated;
GRANT ALL ON public.lead_customers TO service_role;

ALTER TABLE public.lead_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read lead_customers" ON public.lead_customers;
CREATE POLICY "Staff can read lead_customers"
  ON public.lead_customers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Staff can insert lead_customers" ON public.lead_customers;
CREATE POLICY "Staff can insert lead_customers"
  ON public.lead_customers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

DROP POLICY IF EXISTS "Staff can update lead_customers" ON public.lead_customers;
CREATE POLICY "Staff can update lead_customers"
  ON public.lead_customers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.id = auth.uid()));

CREATE OR REPLACE FUNCTION public.lead_customers_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_lead_customers_touch ON public.lead_customers;
CREATE TRIGGER trg_lead_customers_touch
  BEFORE UPDATE ON public.lead_customers
  FOR EACH ROW EXECUTE FUNCTION public.lead_customers_touch_updated_at();

ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS customer_contact_id uuid REFERENCES public.lead_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sales_leads_customer_contact_id_idx
  ON public.sales_leads (customer_contact_id);

-- Backfill (fixed uuid aggregate: cast to text then back)
INSERT INTO public.lead_customers (
  phone_normalized, phone_original, attempt_count, next_eligible_at,
  last_attempt_at, do_not_call, do_not_call_reason, do_not_call_at,
  dormant, dormant_at, contacted_owner
)
SELECT
  public.normalize_phone_uk(sl.phone),
  MIN(sl.phone),
  COALESCE(MAX(sl.orr_attempt_count), 0),
  MAX(sl.orr_next_release_at),
  MAX(sl.orr_last_attempt_at),
  bool_or(COALESCE(sl.do_not_contact, false)),
  MAX(sl.do_not_contact_reason),
  MAX(sl.do_not_contact_at),
  bool_or(sl.orr_dormant_at IS NOT NULL),
  MAX(sl.orr_dormant_at),
  (array_agg(sl.owner_agent) FILTER (WHERE sl.owner_agent IS NOT NULL))[1]
FROM public.sales_leads sl
WHERE sl.phone IS NOT NULL
  AND public.normalize_phone_uk(sl.phone) IS NOT NULL
GROUP BY public.normalize_phone_uk(sl.phone)
ON CONFLICT (phone_normalized) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sales_leads_link_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_lc public.lead_customers%ROWTYPE;
BEGIN
  v_norm := public.normalize_phone_uk(NEW.phone);
  NEW.phone_normalized := v_norm;
  IF v_norm IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_lc FROM public.lead_customers WHERE phone_normalized = v_norm LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.lead_customers (phone_normalized, phone_original)
    VALUES (v_norm, NEW.phone)
    RETURNING * INTO v_lc;
  END IF;

  NEW.customer_contact_id := v_lc.id;

  IF TG_OP = 'INSERT' THEN
    NEW.orr_attempt_count   := GREATEST(COALESCE(NEW.orr_attempt_count, 0), COALESCE(v_lc.attempt_count, 0));
    NEW.orr_next_release_at := COALESCE(NEW.orr_next_release_at, v_lc.next_eligible_at);
    NEW.orr_last_attempt_at := COALESCE(NEW.orr_last_attempt_at, v_lc.last_attempt_at);
    IF v_lc.do_not_call THEN
      NEW.do_not_contact := true;
      NEW.do_not_contact_reason := COALESCE(NEW.do_not_contact_reason, v_lc.do_not_call_reason);
      NEW.do_not_contact_at     := COALESCE(NEW.do_not_contact_at, v_lc.do_not_call_at);
    END IF;
    IF v_lc.dormant AND NEW.orr_dormant_at IS NULL THEN
      NEW.orr_dormant_at := v_lc.dormant_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_leads_link_customer ON public.sales_leads;
CREATE TRIGGER trg_sales_leads_link_customer
  BEFORE INSERT OR UPDATE OF phone ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.sales_leads_link_customer();
