-- Fix the active trigger function to properly derive lead_source from cart_metadata
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_abandoned_cart()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_lead_id UUID;
  v_dedup_lead_id UUID;
  v_terminal_lead_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_phone TEXT;
  v_clean_email TEXT;
  v_assigned_agent UUID;
  v_derived_source lead_source;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_clean_email := lower(btrim(NEW.email));

  -- Derive lead source from cart metadata (gclid = google_ad, fbclid = social_ad, else website)
  v_derived_source := public.derive_lead_source(NEW.cart_metadata);

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  -- 1) IDEMPOTENCY: same cart already created a lead
  SELECT id INTO v_existing_lead_id
  FROM public.sales_leads
  WHERE abandoned_cart_id = NEW.id
    AND status NOT IN ('converted', 'lost', 'fake_lead')
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET
      email = v_clean_email,
      phone = COALESCE(NULLIF(btrim(NEW.phone), ''), phone),
      first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
      last_name = COALESCE(v_last_name, last_name),
      vehicle_reg = COALESCE(NULLIF(btrim(NEW.vehicle_reg), ''), vehicle_reg),
      vehicle_make = COALESCE(NULLIF(btrim(NEW.vehicle_make), ''), vehicle_make),
      vehicle_model = COALESCE(NULLIF(btrim(NEW.vehicle_model), ''), vehicle_model),
      vehicle_year = COALESCE(NULLIF(btrim(NEW.vehicle_year), ''), vehicle_year),
      vehicle_type = COALESCE(NULLIF(btrim(NEW.vehicle_type), ''), vehicle_type),
      mileage = COALESCE(NULLIF(btrim(NEW.mileage), ''), mileage),
      plan_interest = COALESCE(NEW.plan_name, plan_interest),
      cart_value = COALESCE(NEW.total_price, cart_value),
      lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
      last_activity_date = now(),
      updated_at = now()
    WHERE id = v_existing_lead_id;
    RETURN NEW;
  END IF;

  -- 2) PHONE DEDUP
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
        phone = COALESCE(NULLIF(btrim(NEW.phone), ''), phone),
        vehicle_reg = COALESCE(NULLIF(btrim(NEW.vehicle_reg), ''), vehicle_reg),
        vehicle_make = COALESCE(NULLIF(btrim(NEW.vehicle_make), ''), vehicle_make),
        vehicle_model = COALESCE(NULLIF(btrim(NEW.vehicle_model), ''), vehicle_model),
        vehicle_year = COALESCE(NULLIF(btrim(NEW.vehicle_year), ''), vehicle_year),
        vehicle_type = COALESCE(NULLIF(btrim(NEW.vehicle_type), ''), vehicle_type),
        mileage = COALESCE(NULLIF(btrim(NEW.mileage), ''), mileage),
        plan_interest = COALESCE(NEW.plan_name, plan_interest),
        cart_value = COALESCE(NEW.total_price, cart_value),
        abandoned_cart_id = NEW.id,
        lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
        last_activity_date = now(),
        resubmission_count = COALESCE(resubmission_count, 0) + 1,
        last_resubmitted_at = now(),
        updated_at = now()
      WHERE id = v_dedup_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) EMAIL DEDUP
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
      phone = COALESCE(NULLIF(btrim(NEW.phone), ''), phone),
      first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
      last_name = COALESCE(v_last_name, last_name),
      vehicle_reg = COALESCE(NULLIF(btrim(NEW.vehicle_reg), ''), vehicle_reg),
      vehicle_make = COALESCE(NULLIF(btrim(NEW.vehicle_make), ''), vehicle_make),
      vehicle_model = COALESCE(NULLIF(btrim(NEW.vehicle_model), ''), vehicle_model),
      vehicle_year = COALESCE(NULLIF(btrim(NEW.vehicle_year), ''), vehicle_year),
      vehicle_type = COALESCE(NULLIF(btrim(NEW.vehicle_type), ''), vehicle_type),
      mileage = COALESCE(NULLIF(btrim(NEW.mileage), ''), mileage),
      plan_interest = COALESCE(NEW.plan_name, plan_interest),
      cart_value = COALESCE(NEW.total_price, cart_value),
      abandoned_cart_id = NEW.id,
      lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
      last_activity_date = now(),
      resubmission_count = COALESCE(resubmission_count, 0) + 1,
      last_resubmitted_at = now(),
      updated_at = now()
    WHERE id = v_dedup_lead_id;
    RETURN NEW;
  END IF;

  -- 4) TERMINAL GUARD
  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_terminal_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND status IN ('converted', 'lost', 'fake_lead')
    LIMIT 1;
    IF v_terminal_lead_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  SELECT id INTO v_terminal_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND status IN ('converted', 'lost', 'fake_lead')
  LIMIT 1;
  IF v_terminal_lead_id IS NOT NULL THEN RETURN NEW; END IF;

  -- 5) Reset daily caps if needed
  PERFORM reset_daily_caps();

  -- 6) INSERT with proper source attribution
  BEGIN
    v_assigned_agent := public.get_next_sales_user();

    INSERT INTO public.sales_leads (
      first_name, last_name, email, phone, lead_source, status, priority,
      vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
      mileage, plan_interest, cart_value, step_two_completed_at,
      abandoned_cart_id, created_at, updated_at, last_activity_date,
      resubmission_count, assigned_to, assigned_at
    ) VALUES (
      v_first_name, v_last_name, v_clean_email, NULLIF(btrim(NEW.phone), ''),
      v_derived_source, 'new'::lead_status, 'medium',
      NULLIF(btrim(NEW.vehicle_reg), ''), NULLIF(btrim(NEW.vehicle_make), ''),
      NULLIF(btrim(NEW.vehicle_model), ''), NULLIF(btrim(NEW.vehicle_year), ''),
      NULLIF(btrim(NEW.vehicle_type), ''),
      NULLIF(btrim(NEW.mileage), ''), NEW.plan_name, NEW.total_price,
      CASE WHEN COALESCE(NEW.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
      NEW.id, COALESCE(NEW.created_at, now()), now(), now(),
      0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END
    );

    IF v_assigned_agent IS NOT NULL THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = assigned_today + 1,
          last_assigned_at = now(),
          updated_at = now()
      WHERE admin_user_id = v_assigned_agent;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
    VALUES ('lead_creation_failed', 'auto_create_lead_trigger',
      jsonb_build_object('cart_id', NEW.id, 'email', v_clean_email, 'phone', NEW.phone),
      SQLERRM);
  END;

  RETURN NEW;
END;
$function$;

-- Fix ALL existing misattributed leads by re-deriving source from their linked cart's metadata
UPDATE sales_leads sl
SET lead_source = public.derive_lead_source(ac.cart_metadata)
FROM abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND sl.lead_source = 'website'
  AND public.derive_lead_source(ac.cart_metadata) != 'website';