
-- Backfill acquisition_source on manual back-office customers from their original sales_leads / abandoned_carts record
-- Match on normalized email OR normalized registration plate

WITH manual_no_source AS (
  SELECT id,
         lower(coalesce(email,'')) AS norm_email,
         upper(replace(coalesce(registration_plate,''),' ','')) AS norm_reg
  FROM public.customers
  WHERE is_manual_entry = true
    AND (acquisition_source IS NULL OR acquisition_source = '')
    AND (gclid IS NULL OR gclid = '')
    AND is_deleted = false
),
lead_match AS (
  SELECT DISTINCT ON (m.id)
    m.id AS customer_id,
    CASE sl.lead_source::text
      WHEN 'google_ad' THEN 'google_ads'
      WHEN 'social_ad' THEN 'facebook_ads'
      WHEN 'website'   THEN 'website'
      ELSE sl.lead_source::text
    END AS resolved_source
  FROM manual_no_source m
  JOIN public.sales_leads sl
    ON (sl.email IS NOT NULL AND lower(sl.email) = m.norm_email AND m.norm_email <> '')
    OR (sl.vehicle_reg IS NOT NULL AND upper(replace(sl.vehicle_reg,' ','')) = m.norm_reg AND m.norm_reg <> '')
  WHERE sl.lead_source IS NOT NULL
  ORDER BY m.id, sl.created_at ASC
),
cart_match AS (
  SELECT DISTINCT ON (m.id)
    m.id AS customer_id,
    COALESCE(
      ac.cart_metadata->>'lead_source',
      CASE WHEN (ac.cart_metadata->>'gclid') IS NOT NULL AND (ac.cart_metadata->>'gclid') <> '' THEN 'google_ads' END,
      CASE WHEN (ac.cart_metadata->>'fbclid') IS NOT NULL AND (ac.cart_metadata->>'fbclid') <> '' THEN 'facebook_ads' END,
      CASE WHEN lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('google','google_ads','adwords') THEN 'google_ads' END,
      CASE WHEN lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('facebook','fb','meta','instagram') THEN 'facebook_ads' END
    ) AS resolved_source
  FROM manual_no_source m
  JOIN public.abandoned_carts ac
    ON (ac.email IS NOT NULL AND lower(ac.email) = m.norm_email AND m.norm_email <> '')
    OR (ac.vehicle_reg IS NOT NULL AND upper(replace(ac.vehicle_reg,' ','')) = m.norm_reg AND m.norm_reg <> '')
  ORDER BY m.id, ac.created_at ASC
)
UPDATE public.customers c
SET acquisition_source = COALESCE(lm.resolved_source, cm.resolved_source)
FROM manual_no_source m
LEFT JOIN lead_match lm ON lm.customer_id = m.id
LEFT JOIN cart_match cm ON cm.customer_id = m.id
WHERE c.id = m.id
  AND COALESCE(lm.resolved_source, cm.resolved_source) IS NOT NULL;

-- Trigger: future manual entries inherit acquisition_source from prior lead/cart automatically
CREATE OR REPLACE FUNCTION public.inherit_acquisition_source_for_manual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_email text := lower(coalesce(NEW.email,''));
  v_norm_reg   text := upper(replace(coalesce(NEW.registration_plate,''),' ',''));
  v_source     text;
BEGIN
  IF NEW.is_manual_entry IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.acquisition_source IS NOT NULL AND NEW.acquisition_source <> '' THEN
    RETURN NEW;
  END IF;
  IF NEW.gclid IS NOT NULL AND NEW.gclid <> '' THEN
    RETURN NEW;
  END IF;

  SELECT CASE sl.lead_source::text
           WHEN 'google_ad' THEN 'google_ads'
           WHEN 'social_ad' THEN 'facebook_ads'
           WHEN 'website'   THEN 'website'
           ELSE sl.lead_source::text
         END
    INTO v_source
  FROM public.sales_leads sl
  WHERE sl.lead_source IS NOT NULL
    AND ((sl.email IS NOT NULL AND lower(sl.email) = v_norm_email AND v_norm_email <> '')
      OR (sl.vehicle_reg IS NOT NULL AND upper(replace(sl.vehicle_reg,' ','')) = v_norm_reg AND v_norm_reg <> ''))
  ORDER BY sl.created_at ASC
  LIMIT 1;

  IF v_source IS NULL THEN
    SELECT COALESCE(
             ac.cart_metadata->>'lead_source',
             CASE WHEN (ac.cart_metadata->>'gclid') IS NOT NULL AND (ac.cart_metadata->>'gclid') <> '' THEN 'google_ads' END,
             CASE WHEN (ac.cart_metadata->>'fbclid') IS NOT NULL AND (ac.cart_metadata->>'fbclid') <> '' THEN 'facebook_ads' END,
             CASE WHEN lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('google','google_ads','adwords') THEN 'google_ads' END,
             CASE WHEN lower(coalesce(ac.cart_metadata->>'utm_source','')) IN ('facebook','fb','meta','instagram') THEN 'facebook_ads' END
           )
      INTO v_source
    FROM public.abandoned_carts ac
    WHERE (ac.email IS NOT NULL AND lower(ac.email) = v_norm_email AND v_norm_email <> '')
       OR (ac.vehicle_reg IS NOT NULL AND upper(replace(ac.vehicle_reg,' ','')) = v_norm_reg AND v_norm_reg <> '')
    ORDER BY ac.created_at ASC
    LIMIT 1;
  END IF;

  IF v_source IS NOT NULL THEN
    NEW.acquisition_source := v_source;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_acquisition_source_for_manual ON public.customers;
CREATE TRIGGER trg_inherit_acquisition_source_for_manual
BEFORE INSERT OR UPDATE OF is_manual_entry, email, registration_plate ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.inherit_acquisition_source_for_manual();
