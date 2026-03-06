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
  IF NEW.phone IS NOT NULL AND btrim(NEW.phone) = '' THEN NEW.phone := NULL; END IF;
  IF NEW.first_name IS NOT NULL AND btrim(NEW.first_name) = '' THEN NEW.first_name := NULL; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.phone IS NOT NULL AND btrim(OLD.phone) <> '' AND NEW.phone IS NULL THEN NEW.phone := OLD.phone; END IF;
    IF OLD.first_name IS NOT NULL AND btrim(OLD.first_name) <> '' AND NEW.first_name IS NULL THEN NEW.first_name := OLD.first_name; END IF;
  END IF;

  IF NEW.phone IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(btrim(ac.phone), '') INTO v_hist_phone
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.phone IS NOT NULL AND btrim(ac.phone) <> ''
    ORDER BY ac.created_at DESC LIMIT 1;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(sl.phone), '') INTO v_hist_phone
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.id IS DISTINCT FROM NEW.id
        AND sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
      ORDER BY sl.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(ma.phone), '') INTO v_hist_phone
      FROM public.marketing_audience ma
      WHERE lower(ma.email) = lower(NEW.email)
        AND ma.phone IS NOT NULL AND btrim(ma.phone) <> ''
      ORDER BY ma.synced_at DESC NULLS LAST LIMIT 1;
    END IF;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(c.phone), '') INTO v_hist_phone
      FROM public.customers c
      WHERE lower(c.email) = lower(NEW.email)
        AND c.phone IS NOT NULL AND btrim(c.phone) <> ''
      ORDER BY c.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_phone IS NULL THEN
      SELECT NULLIF(btrim(cs.phone), '') INTO v_hist_phone
      FROM public.contact_submissions cs
      WHERE lower(cs.email) = lower(NEW.email)
        AND cs.phone IS NOT NULL AND btrim(cs.phone) <> ''
      ORDER BY cs.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_phone IS NOT NULL THEN NEW.phone := v_hist_phone; END IF;
  END IF;

  IF NEW.first_name IS NULL AND NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT NULLIF(split_part(btrim(ac.full_name), ' ', 1), '') INTO v_hist_first_name
    FROM public.abandoned_carts ac
    WHERE lower(ac.email) = lower(NEW.email)
      AND ac.full_name IS NOT NULL AND btrim(ac.full_name) <> ''
    ORDER BY ac.created_at DESC LIMIT 1;

    IF v_hist_first_name IS NULL THEN
      SELECT NULLIF(btrim(sl.first_name), '') INTO v_hist_first_name
      FROM public.sales_leads sl
      WHERE lower(sl.email) = lower(NEW.email)
        AND sl.id IS DISTINCT FROM NEW.id
        AND sl.first_name IS NOT NULL AND btrim(sl.first_name) <> ''
      ORDER BY sl.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_first_name IS NULL THEN
      SELECT NULLIF(split_part(btrim(ma.full_name), ' ', 1), '') INTO v_hist_first_name
      FROM public.marketing_audience ma
      WHERE lower(ma.email) = lower(NEW.email)
        AND ma.full_name IS NOT NULL AND btrim(ma.full_name) <> ''
      ORDER BY ma.synced_at DESC NULLS LAST LIMIT 1;
    END IF;

    IF v_hist_first_name IS NULL THEN
      SELECT NULLIF(btrim(c.first_name), '') INTO v_hist_first_name
      FROM public.customers c
      WHERE lower(c.email) = lower(NEW.email)
        AND c.first_name IS NOT NULL AND btrim(c.first_name) <> ''
      ORDER BY c.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_first_name IS NULL THEN
      SELECT NULLIF(split_part(btrim(cs.name), ' ', 1), '') INTO v_hist_first_name
      FROM public.contact_submissions cs
      WHERE lower(cs.email) = lower(NEW.email)
        AND cs.name IS NOT NULL AND btrim(cs.name) <> ''
      ORDER BY cs.created_at DESC LIMIT 1;
    END IF;

    IF v_hist_first_name IS NOT NULL THEN NEW.first_name := v_hist_first_name; END IF;
  END IF;

  RETURN NEW;
END;
$function$;