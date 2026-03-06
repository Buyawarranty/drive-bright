-- SAFEGUARD: Prevent phone from ever being wiped on abandoned_carts if it already has a value
CREATE OR REPLACE FUNCTION public.protect_phone_on_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If existing row has a valid phone and new value is NULL or empty, preserve the old phone
  IF OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' THEN
    IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
      NEW.phone := OLD.phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger fires BEFORE UPDATE so it can modify NEW
DROP TRIGGER IF EXISTS trg_protect_phone_abandoned_cart ON public.abandoned_carts;
CREATE TRIGGER trg_protect_phone_abandoned_cart
  BEFORE UPDATE ON public.abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_phone_on_abandoned_cart();

-- SAFEGUARD: Prevent phone from ever being wiped on sales_leads if it already has a value
CREATE OR REPLACE FUNCTION public.protect_phone_on_sales_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If existing row has a valid phone and new value is NULL or empty, preserve the old phone
  IF OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' THEN
    IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
      NEW.phone := OLD.phone;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger fires BEFORE UPDATE so it can modify NEW
DROP TRIGGER IF EXISTS trg_protect_phone_sales_lead ON public.sales_leads;
CREATE TRIGGER trg_protect_phone_sales_lead
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_phone_on_sales_lead();