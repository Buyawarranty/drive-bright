
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_abandoned_cart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_lead_id UUID;
  v_dedup_lead_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_email_local TEXT;
  v_clean_phone TEXT;
  v_clean_email TEXT;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_email_local := NULLIF(btrim(split_part(lower(NEW.email), '@', 1)), '');
  v_clean_email := lower(btrim(NEW.email));

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := COALESCE(v_email_local, 'Lead');
    v_last_name := NULL;
  END IF;

  -- ============================================================
  -- 1) IDEMPOTENCY: Check for existing lead linked to this cart
  --    BUT skip if that lead is in a terminal state
  -- ============================================================
  SELECT id INTO v_existing_lead_id
  FROM public.sales_leads
  WHERE abandoned_cart_id = NEW.id
    AND status NOT IN ('converted', 'lost', 'fake_lead')
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET
      email = v_clean_email,
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

  -- ============================================================
  -- 2) PHONE DEDUP: Same phone within 7 days → update existing lead
  --    SKIP leads in terminal states (converted, lost, fake_lead)
  -- ============================================================
  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_dedup_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND created_at > now() - interval '7 days'
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_dedup_lead_id IS NOT NULL THEN
      UPDATE public.sales_leads
      SET
        email = v_clean_email,
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
        abandoned_cart_id = NEW.id,
        last_activity_date = now(),
        resubmission_count = COALESCE(resubmission_count, 0) + 1,
        last_resubmitted_at = now(),
        status = 'new',
        updated_at = now()
      WHERE id = v_dedup_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  -- ============================================================
  -- 3) EMAIL DEDUP: Same email within 7 days → update existing lead
  --    SKIP leads in terminal states (converted, lost, fake_lead)
  -- ============================================================
  SELECT id INTO v_dedup_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND created_at > now() - interval '7 days'
    AND status NOT IN ('converted', 'lost', 'fake_lead')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_dedup_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET
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
      abandoned_cart_id = NEW.id,
      last_activity_date = now(),
      resubmission_count = COALESCE(resubmission_count, 0) + 1,
      last_resubmitted_at = now(),
      status = 'new',
      updated_at = now()
    WHERE id = v_dedup_lead_id;
    RETURN NEW;
  END IF;

  -- ============================================================
  -- 4) NEW LEAD: No match found — insert new lead
  -- ============================================================
  INSERT INTO public.sales_leads (
    first_name, last_name, email, phone, lead_source, status, priority,
    vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
    mileage, plan_interest, cart_value, step_two_completed_at,
    abandoned_cart_id, created_at, updated_at, last_activity_date,
    resubmission_count
  ) VALUES (
    v_first_name, v_last_name, v_clean_email, NEW.phone,
    'website', 'new', 'medium',
    NEW.vehicle_reg, NEW.vehicle_make, NEW.vehicle_model, NEW.vehicle_year, NEW.vehicle_type,
    NEW.mileage, NEW.plan_name, NEW.total_price,
    CASE WHEN COALESCE(NEW.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
    NEW.id, COALESCE(NEW.created_at, now()), now(), now(),
    0
  );

  RETURN NEW;
END;
$function$;
