
-- 1. Backfill missing gclid on customers from abandoned_carts.cart_metadata
UPDATE public.customers c
SET gclid = sub.gclid
FROM (
  SELECT DISTINCT ON (lower(ac.email))
    lower(ac.email) AS email_lc,
    ac.cart_metadata->>'gclid' AS gclid
  FROM public.abandoned_carts ac
  WHERE ac.cart_metadata->>'gclid' IS NOT NULL
    AND ac.cart_metadata->>'gclid' <> ''
  ORDER BY lower(ac.email), ac.created_at DESC
) sub
WHERE c.gclid IS NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = sub.email_lc;

-- 2. Trigger: on customers insert/update, if gclid is null, backfill from latest matching abandoned_carts
CREATE OR REPLACE FUNCTION public.backfill_customer_gclid_from_cart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gclid TEXT;
BEGIN
  IF (NEW.gclid IS NULL OR NEW.gclid = '') AND NEW.email IS NOT NULL THEN
    SELECT ac.cart_metadata->>'gclid'
      INTO v_gclid
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.cart_metadata->>'gclid' IS NOT NULL
      AND ac.cart_metadata->>'gclid' <> ''
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_gclid IS NOT NULL THEN
      NEW.gclid := v_gclid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_customer_gclid ON public.customers;
CREATE TRIGGER trg_backfill_customer_gclid
BEFORE INSERT OR UPDATE OF email, gclid ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.backfill_customer_gclid_from_cart();
