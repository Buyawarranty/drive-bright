-- Expand identity safeguards: preserve and hydrate phone + first_name/full_name on both insert and update.

-- 1) Abandoned carts safeguard (phone + full_name)
CREATE OR REPLACE FUNCTION public.protect_phone_on_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hist_phone text;
  v_hist_name text;
BEGIN
  -- Normalize incoming blanks
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) = '' THEN
    NEW.phone := NULL;
  END IF;
  IF NEW.full_name IS NOT NULL AND btrim(NEW.full_name) = '' THEN
    NEW.full_name := NULL;
  END IF;

  -- Preserve existing values on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' AND NEW.phone IS NULL THEN
      NEW.phone := OLD.phone;
    END IF;
    IF OLD.full_name IS NOT NULL AND btrim(OLD.full_name) <> '' AND NEW.full_name IS NULL THEN
      NEW.full_name := OLD.full_name;
    END IF;
  END IF;

  -- Hydrate phone from history by email if still missing
  IF NEW.phone IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(btrim(ac.phone), '')
      INTO v_hist_phone
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.id IS DISTINCT FROM NEW.id
      AND ac.phone IS NOT NULL
      AND btrim(ac.phone) <> ''
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(sl.phone), '')
        INTO v_hist_phone
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.phone IS NOT NULL
        AND btrim(sl.phone) <> ''
      ORDER BY sl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_hist_phone IS NOT NULL THEN
      NEW.phone := v_hist_phone;
    END IF;
  END IF;

  -- Hydrate full_name from history by email if still missing
  IF NEW.full_name IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(btrim(ac.full_name), '')
      INTO v_hist_name
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.id IS DISTINCT FROM NEW.id
      AND ac.full_name IS NOT NULL
      AND btrim(ac.full_name) <> ''
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_hist_name IS NULL THEN
      SELECT NULLIF(btrim(sl.first_name), '')
        INTO v_hist_name
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.first_name IS NOT NULL
        AND btrim(sl.first_name) <> ''
      ORDER BY sl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_hist_name IS NOT NULL THEN
      NEW.full_name := v_hist_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_phone_abandoned_cart ON public.abandoned_carts;
CREATE TRIGGER trg_protect_phone_abandoned_cart
  BEFORE INSERT OR UPDATE ON public.abandoned_carts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_phone_on_abandoned_cart();

-- 2) Sales leads safeguard (phone + first_name)
CREATE OR REPLACE FUNCTION public.protect_phone_on_sales_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hist_phone text;
  v_hist_first_name text;
BEGIN
  -- Normalize incoming blanks
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) = '' THEN
    NEW.phone := NULL;
  END IF;
  IF NEW.first_name IS NOT NULL AND btrim(NEW.first_name) = '' THEN
    NEW.first_name := NULL;
  END IF;

  -- Preserve existing values on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' AND NEW.phone IS NULL THEN
      NEW.phone := OLD.phone;
    END IF;
    IF OLD.first_name IS NOT NULL AND btrim(OLD.first_name) <> '' AND NEW.first_name IS NULL THEN
      NEW.first_name := OLD.first_name;
    END IF;
  END IF;

  -- Hydrate phone from abandoned carts and prior leads if still missing
  IF NEW.phone IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(btrim(ac.phone), '')
      INTO v_hist_phone
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.phone IS NOT NULL
      AND btrim(ac.phone) <> ''
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(sl.phone), '')
        INTO v_hist_phone
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.id IS DISTINCT FROM NEW.id
        AND sl.phone IS NOT NULL
        AND btrim(sl.phone) <> ''
      ORDER BY sl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_hist_phone IS NOT NULL THEN
      NEW.phone := v_hist_phone;
    END IF;
  END IF;

  -- Hydrate first_name from abandoned carts and prior leads if still missing
  IF NEW.first_name IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(split_part(btrim(ac.full_name), ' ', 1), '')
      INTO v_hist_first_name
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.full_name IS NOT NULL
      AND btrim(ac.full_name) <> ''
    ORDER BY ac.created_at DESC
    LIMIT 1;

    IF v_hist_first_name IS NULL THEN
      SELECT NULLIF(btrim(sl.first_name), '')
        INTO v_hist_first_name
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.id IS DISTINCT FROM NEW.id
        AND sl.first_name IS NOT NULL
        AND btrim(sl.first_name) <> ''
      ORDER BY sl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_hist_first_name IS NOT NULL THEN
      NEW.first_name := v_hist_first_name;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_phone_sales_lead ON public.sales_leads;
CREATE TRIGGER trg_protect_phone_sales_lead
  BEFORE INSERT OR UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_phone_on_sales_lead();

-- 3) Backfill currently recoverable missing values in sales_leads
WITH lead_recovery AS (
  SELECT sl.id,
         COALESCE(
           NULLIF(btrim(sl.phone), ''),
           (
             SELECT NULLIF(btrim(ac.phone), '')
             FROM public.abandoned_carts ac
             WHERE lower(ac.email) = lower(sl.email)
               AND ac.phone IS NOT NULL
               AND btrim(ac.phone) <> ''
             ORDER BY ac.created_at DESC
             LIMIT 1
           ),
           (
             SELECT NULLIF(btrim(sl2.phone), '')
             FROM public.sales_leads sl2
             WHERE lower(sl2.email) = lower(sl.email)
               AND sl2.id <> sl.id
               AND sl2.phone IS NOT NULL
               AND btrim(sl2.phone) <> ''
             ORDER BY sl2.created_at DESC
             LIMIT 1
           )
         ) AS phone_to_set,
         COALESCE(
           NULLIF(btrim(sl.first_name), ''),
           (
             SELECT NULLIF(split_part(btrim(ac.full_name), ' ', 1), '')
             FROM public.abandoned_carts ac
             WHERE lower(ac.email) = lower(sl.email)
               AND ac.full_name IS NOT NULL
               AND btrim(ac.full_name) <> ''
             ORDER BY ac.created_at DESC
             LIMIT 1
           ),
           (
             SELECT NULLIF(btrim(sl2.first_name), '')
             FROM public.sales_leads sl2
             WHERE lower(sl2.email) = lower(sl.email)
               AND sl2.id <> sl.id
               AND sl2.first_name IS NOT NULL
               AND btrim(sl2.first_name) <> ''
             ORDER BY sl2.created_at DESC
             LIMIT 1
           )
         ) AS first_name_to_set
  FROM public.sales_leads sl
  WHERE (sl.phone IS NULL OR btrim(sl.phone) = '' OR sl.first_name IS NULL OR btrim(sl.first_name) = '')
)
UPDATE public.sales_leads sl
SET phone = CASE
              WHEN (sl.phone IS NULL OR btrim(sl.phone) = '') AND lr.phone_to_set IS NOT NULL THEN lr.phone_to_set
              ELSE sl.phone
            END,
    first_name = CASE
                   WHEN (sl.first_name IS NULL OR btrim(sl.first_name) = '') AND lr.first_name_to_set IS NOT NULL THEN lr.first_name_to_set
                   ELSE sl.first_name
                 END,
    updated_at = now()
FROM lead_recovery lr
WHERE sl.id = lr.id
  AND (
    ((sl.phone IS NULL OR btrim(sl.phone) = '') AND lr.phone_to_set IS NOT NULL)
    OR
    ((sl.first_name IS NULL OR btrim(sl.first_name) = '') AND lr.first_name_to_set IS NOT NULL)
  );