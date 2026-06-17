
CREATE OR REPLACE FUNCTION public.mark_lead_and_cart_converted_from_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm_email text := lower(trim(coalesce(NEW.email, '')));
  norm_reg   text := upper(regexp_replace(coalesce(NEW.registration_plate, ''), '\s+', '', 'g'));
BEGIN
  -- Skip soft-deleted / cancelled / refunded customers
  IF coalesce(NEW.is_deleted, false) = true
     OR lower(coalesce(NEW.status, '')) IN ('cancelled', 'refunded') THEN
    RETURN NEW;
  END IF;

  IF norm_email = '' AND norm_reg = '' THEN
    RETURN NEW;
  END IF;

  -- Mark matching sales_leads as converted (skip already-converted / terminal statuses)
  UPDATE public.sales_leads sl
  SET status = 'converted'::lead_status,
      is_paid = true,
      converted_at = COALESCE(sl.converted_at, NEW.signup_date, NEW.created_at, now()),
      updated_at = now()
  WHERE sl.status NOT IN ('converted'::lead_status, 'fake_lead'::lead_status)
    AND (
      (norm_email <> '' AND lower(trim(sl.email)) = norm_email)
      OR
      (norm_reg <> '' AND upper(regexp_replace(coalesce(sl.vehicle_reg, ''), '\s+', '', 'g')) = norm_reg)
    );

  -- Mark matching abandoned_carts as converted
  UPDATE public.abandoned_carts ac
  SET is_converted = true,
      converted_at = COALESCE(ac.converted_at, NEW.signup_date, NEW.created_at, now()),
      updated_at = now()
  WHERE coalesce(ac.is_converted, false) = false
    AND (
      (norm_email <> '' AND lower(trim(ac.email)) = norm_email)
      OR
      (norm_reg <> '' AND upper(regexp_replace(coalesce(ac.vehicle_reg, ''), '\s+', '', 'g')) = norm_reg)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_lead_and_cart_converted ON public.customers;
CREATE TRIGGER trg_mark_lead_and_cart_converted
AFTER INSERT OR UPDATE OF email, registration_plate, status, is_deleted, signup_date
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.mark_lead_and_cart_converted_from_customer();
