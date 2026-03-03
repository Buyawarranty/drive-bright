-- Fix lead name fallback + preserve cart creation timestamp for deterministic ordering
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
  v_email_local TEXT;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_email_local := NULLIF(btrim(split_part(lower(NEW.email), '@', 1)), '');

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    -- Fallback so Name column never appears blank for step-2 website leads
    v_first_name := COALESCE(v_email_local, 'Lead');
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
      first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
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
    COALESCE(NEW.created_at, now()),
    now(),
    now()
  );

  RETURN NEW;
END;
$function$;

-- Backfill: align website sales lead timestamps to source cart timestamps for deterministic feed ordering
UPDATE public.sales_leads sl
SET created_at = ac.created_at,
    updated_at = now()
FROM public.abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND sl.lead_source = 'website'
  AND sl.created_at IS DISTINCT FROM ac.created_at;

-- Backfill: populate missing display names from email local-part (only when both names are empty)
UPDATE public.sales_leads
SET first_name = split_part(lower(email), '@', 1),
    last_name = NULL,
    updated_at = now()
WHERE lead_source = 'website'
  AND (first_name IS NULL OR btrim(first_name) = '')
  AND (last_name IS NULL OR btrim(last_name) = '')
  AND email IS NOT NULL
  AND btrim(email) <> '';

-- Re-sequence recent new website leads so they display in strict James -> Isobel -> Ash cycle
WITH ordered_agents AS (
  SELECT adc.admin_user_id,
         row_number() OVER (ORDER BY adc.sort_order ASC, adc.admin_user_id ASC) AS rn,
         count(*) OVER () AS total_agents
  FROM public.agent_distribution_caps adc
  JOIN public.admin_users au ON au.id = adc.admin_user_id
  WHERE au.is_active = true
    AND au.role IN ('sales', 'sales_lead')
    AND COALESCE(adc.paused, false) = false
),
recent_new_leads AS (
  SELECT sl.id,
         row_number() OVER (ORDER BY sl.created_at ASC, sl.id ASC) AS rn
  FROM public.sales_leads sl
  WHERE sl.lead_source = 'website'
    AND sl.status = 'new'
    AND sl.created_at >= now() - interval '7 days'
),
reassign AS (
  SELECT l.id AS lead_id,
         a.admin_user_id
  FROM recent_new_leads l
  JOIN ordered_agents a
    ON a.rn = ((l.rn - 1) % (SELECT max(total_agents) FROM ordered_agents)) + 1
)
UPDATE public.sales_leads sl
SET assigned_to = r.admin_user_id,
    assigned_at = COALESCE(sl.assigned_at, now()),
    updated_at = now()
FROM reassign r
WHERE sl.id = r.lead_id;