
CREATE OR REPLACE FUNCTION public.auto_resolve_checkout_struggle_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
BEGIN
  -- Normalize phone (digits only, last 10 for matching UK numbers)
  v_phone := NULLIF(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), '');

  UPDATE public.checkout_struggle_alerts
  SET status = 'resolved', resolved_at = now()
  WHERE status IN ('active', 'acknowledged')
    AND (
      (NEW.email IS NOT NULL AND lower(customer_email) = lower(NEW.email))
      OR (NEW.registration_plate IS NOT NULL
          AND vehicle_reg IS NOT NULL
          AND upper(regexp_replace(vehicle_reg, '\s', '', 'g')) =
              upper(regexp_replace(NEW.registration_plate, '\s', '', 'g')))
      OR (v_phone IS NOT NULL
          AND customer_phone IS NOT NULL
          AND right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = right(v_phone, 10))
    );
  RETURN NEW;
END;
$$;

-- Also fire on UPDATE (repeat customers are upserted, not inserted)
DROP TRIGGER IF EXISTS trg_auto_resolve_struggle_alerts ON public.customers;
CREATE TRIGGER trg_auto_resolve_struggle_alerts
AFTER INSERT OR UPDATE OF email, phone, registration_plate, stripe_session_id, status
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_checkout_struggle_alerts();

-- Also resolve when a policy is created (most reliable purchase signal)
CREATE OR REPLACE FUNCTION public.auto_resolve_struggle_alerts_from_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_phone TEXT;
  v_reg TEXT;
BEGIN
  SELECT email, phone, registration_plate
    INTO v_email, v_phone, v_reg
  FROM public.customers
  WHERE id = NEW.customer_id;

  v_phone := NULLIF(regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g'), '');

  UPDATE public.checkout_struggle_alerts
  SET status = 'resolved', resolved_at = now()
  WHERE status IN ('active', 'acknowledged')
    AND (
      (v_email IS NOT NULL AND lower(customer_email) = lower(v_email))
      OR (v_reg IS NOT NULL AND vehicle_reg IS NOT NULL
          AND upper(regexp_replace(vehicle_reg, '\s', '', 'g')) =
              upper(regexp_replace(v_reg, '\s', '', 'g')))
      OR (v_phone IS NOT NULL AND customer_phone IS NOT NULL
          AND right(regexp_replace(customer_phone, '\D', '', 'g'), 10) = right(v_phone, 10))
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_resolve_struggle_alerts_policy ON public.customer_policies;
CREATE TRIGGER trg_auto_resolve_struggle_alerts_policy
AFTER INSERT ON public.customer_policies
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_struggle_alerts_from_policy();
