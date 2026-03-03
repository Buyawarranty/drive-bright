CREATE OR REPLACE FUNCTION public.auto_create_lead_from_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_lead_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := split_part(v_full_name, ' ', 1);
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(v_first_name) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  -- one lead per cart; updates to same cart should not create duplicates
  SELECT id
  INTO v_existing_lead_id
  FROM public.sales_leads
  WHERE abandoned_cart_id = NEW.id
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET
      email = lower(NEW.email),
      phone = COALESCE(NEW.phone, phone),
      first_name = COALESCE(v_first_name, first_name),
      last_name = COALESCE(v_last_name, last_name),
      vehicle_reg = COALESCE(NEW.vehicle_reg, vehicle_reg),
      vehicle_make = COALESCE(NEW.vehicle_make, vehicle_make),
      vehicle_model = COALESCE(NEW.vehicle_model, vehicle_model),
      vehicle_year = COALESCE(NEW.vehicle_year, vehicle_year),
      vehicle_type = COALESCE(NEW.vehicle_type, vehicle_type),
      mileage = COALESCE(NEW.mileage, mileage),
      plan_interest = COALESCE(NEW.plan_name, plan_interest),
      cart_value = COALESCE(NEW.total_price, cart_value),
      last_activity_date = now(),
      updated_at = now()
    WHERE id = v_existing_lead_id;

    RETURN NEW;
  END IF;

  -- New cart: ALWAYS insert a new sales_lead.
  -- Round robin assignment happens in trg_auto_assign_lead.
  INSERT INTO public.sales_leads (
    first_name,
    last_name,
    email,
    phone,
    lead_source,
    status,
    priority,
    vehicle_reg,
    vehicle_make,
    vehicle_model,
    vehicle_year,
    vehicle_type,
    mileage,
    plan_interest,
    cart_value,
    step_two_completed_at,
    abandoned_cart_id,
    created_at,
    updated_at,
    last_activity_date
  ) VALUES (
    v_first_name,
    v_last_name,
    lower(NEW.email),
    NEW.phone,
    'website',
    'new',
    'medium',
    NEW.vehicle_reg,
    NEW.vehicle_make,
    NEW.vehicle_model,
    NEW.vehicle_year,
    NEW.vehicle_type,
    NEW.mileage,
    NEW.plan_name,
    NEW.total_price,
    CASE WHEN COALESCE(NEW.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
    NEW.id,
    now(),
    now(),
    now()
  );

  RETURN NEW;
END;
$function$;

-- Remove email-like values from name fields so Name column doesn't show raw emails
UPDATE public.sales_leads
SET
  first_name = CASE WHEN first_name IS NOT NULL AND position('@' in first_name) > 0 THEN NULL ELSE first_name END,
  last_name = CASE WHEN last_name IS NOT NULL AND position('@' in last_name) > 0 THEN NULL ELSE last_name END,
  updated_at = now()
WHERE
  (first_name IS NOT NULL AND position('@' in first_name) > 0)
  OR (last_name IS NOT NULL AND position('@' in last_name) > 0);

-- Backfill missing leads for carts with no corresponding lead row yet
INSERT INTO public.sales_leads (
  first_name,
  last_name,
  email,
  phone,
  lead_source,
  status,
  priority,
  vehicle_reg,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  vehicle_type,
  mileage,
  plan_interest,
  cart_value,
  step_two_completed_at,
  abandoned_cart_id,
  created_at,
  updated_at,
  last_activity_date
)
SELECT
  CASE
    WHEN NULLIF(btrim(COALESCE(ac.full_name, '')), '') IS NOT NULL
      AND position('@' in btrim(ac.full_name)) = 0
    THEN split_part(btrim(ac.full_name), ' ', 1)
    ELSE NULL
  END AS first_name,
  CASE
    WHEN NULLIF(btrim(COALESCE(ac.full_name, '')), '') IS NOT NULL
      AND position('@' in btrim(ac.full_name)) = 0
    THEN NULLIF(
      btrim(substring(btrim(ac.full_name) from char_length(split_part(btrim(ac.full_name), ' ', 1)) + 1)),
      ''
    )
    ELSE NULL
  END AS last_name,
  lower(ac.email) AS email,
  ac.phone,
  'website',
  'new',
  'medium',
  ac.vehicle_reg,
  ac.vehicle_make,
  ac.vehicle_model,
  ac.vehicle_year,
  ac.vehicle_type,
  ac.mileage,
  ac.plan_name,
  ac.total_price,
  CASE WHEN COALESCE(ac.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
  ac.id,
  ac.created_at,
  now(),
  coalesce(ac.updated_at, ac.created_at)
FROM public.abandoned_carts ac
LEFT JOIN public.sales_leads sl
  ON sl.abandoned_cart_id = ac.id
WHERE sl.id IS NULL
  AND ac.email IS NOT NULL
  AND btrim(ac.email) <> ''
ORDER BY ac.created_at ASC;