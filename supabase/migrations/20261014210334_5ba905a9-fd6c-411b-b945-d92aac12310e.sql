ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS ad_id text;
ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS ad_id text;

CREATE OR REPLACE FUNCTION public.fill_sales_lead_ad_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF NEW.abandoned_cart_id IS NULL THEN RETURN NEW; END IF;
  SELECT nullif(trim(ac.cart_metadata->>'ad_id'),'') INTO v FROM public.abandoned_carts ac WHERE ac.id = NEW.abandoned_cart_id;
  IF v IS NOT NULL THEN NEW.ad_id := v; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fill_sales_lead_ad_id ON public.sales_leads;
CREATE TRIGGER trg_fill_sales_lead_ad_id BEFORE INSERT OR UPDATE OF abandoned_cart_id ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.fill_sales_lead_ad_id();

-- Keep the lead's ad_id fresh when the cart's labels change
CREATE OR REPLACE FUNCTION public.sync_cart_ad_id_to_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := nullif(trim(NEW.cart_metadata->>'ad_id'),'');
BEGIN
  IF v IS NOT NULL AND v IS DISTINCT FROM nullif(trim(OLD.cart_metadata->>'ad_id'),'') THEN
    UPDATE public.sales_leads SET ad_id = v WHERE abandoned_cart_id = NEW.id AND ad_id IS DISTINCT FROM v;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_cart_ad_id_to_lead ON public.abandoned_carts;
CREATE TRIGGER trg_sync_cart_ad_id_to_lead AFTER UPDATE OF cart_metadata ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.sync_cart_ad_id_to_lead();

-- Sales (website, Bumper or agent-closed) keep the ad_id from the visitor's cart / lead
CREATE OR REPLACE FUNCTION public.fill_customer_ad_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text;
BEGIN
  IF NEW.ad_id IS NOT NULL THEN RETURN NEW; END IF;
  SELECT nullif(trim(ac.cart_metadata->>'ad_id'),'') INTO v
  FROM public.abandoned_carts ac
  WHERE ((NEW.email IS NOT NULL AND lower(trim(ac.email)) = lower(trim(NEW.email)))
      OR (NEW.registration_plate IS NOT NULL AND upper(replace(ac.vehicle_reg,' ','')) = upper(replace(NEW.registration_plate,' ',''))))
    AND nullif(trim(ac.cart_metadata->>'ad_id'),'') IS NOT NULL
    AND ac.created_at <= coalesce(NEW.signup_date, now()) + interval '1 day'
    AND ac.created_at >= coalesce(NEW.signup_date, now()) - interval '90 days'
  ORDER BY ac.updated_at DESC NULLS LAST
  LIMIT 1;
  NEW.ad_id := v;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_fill_customer_ad_id ON public.customers;
CREATE TRIGGER trg_fill_customer_ad_id BEFORE INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.fill_customer_ad_id();