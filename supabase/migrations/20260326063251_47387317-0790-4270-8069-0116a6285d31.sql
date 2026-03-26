
-- 1) BACKFILL: Update existing leads that have attribution data in their linked abandoned carts
UPDATE public.sales_leads sl
SET lead_source = 'google_ad'::lead_source
FROM public.abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND sl.lead_source = 'website'
  AND ac.cart_metadata IS NOT NULL
  AND (ac.cart_metadata->>'gclid') IS NOT NULL
  AND (ac.cart_metadata->>'gclid') != '';

UPDATE public.sales_leads sl
SET lead_source = 'social_ad'::lead_source
FROM public.abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND sl.lead_source = 'website'
  AND ac.cart_metadata IS NOT NULL
  AND (ac.cart_metadata->>'fbclid') IS NOT NULL
  AND (ac.cart_metadata->>'fbclid') != '';

-- 2) Helper function to derive lead_source from cart_metadata
CREATE OR REPLACE FUNCTION public.derive_lead_source(p_cart_metadata jsonb)
RETURNS lead_source
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'gclid') IS NOT NULL AND (p_cart_metadata->>'gclid') != '' THEN 'google_ad'::lead_source
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'fbclid') IS NOT NULL AND (p_cart_metadata->>'fbclid') != '' THEN 'social_ad'::lead_source
    ELSE 'website'::lead_source
  END;
$$;

-- 3) Update the main trigger to use attribution-aware lead_source
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_cart()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_dedup_lead_id UUID;
  v_terminal_lead_id UUID;
  v_assigned_agent UUID;
  v_derived_source lead_source;
BEGIN
  -- Skip if no email
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  -- Skip step 1
  IF COALESCE(NEW.step_abandoned, 0) < 2 THEN
    RETURN NEW;
  END IF;

  v_clean_email := lower(btrim(NEW.email));
  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');

  -- Derive lead source from cart metadata
  v_derived_source := public.derive_lead_source(NEW.cart_metadata);

  -- Parse name
  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  -- Reset daily caps if needed
  PERFORM reset_daily_caps();

  -- 1) PHONE DEDUP (10+ digits, 7-day window)
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
        email = COALESCE(NULLIF(v_clean_email, ''), email),
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

  -- 5+6) INSERT with attribution-aware source
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

-- 4) Also update recover_orphaned_leads to use attribution-aware source
CREATE OR REPLACE FUNCTION public.recover_orphaned_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cart RECORD;
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_existing_id UUID;
  v_terminal_id UUID;
  v_assigned_agent UUID;
  v_is_recent BOOLEAN;
  v_is_callback BOOLEAN;
  v_derived_source lead_source;
BEGIN
  PERFORM reset_daily_caps();

  FOR v_cart IN
    SELECT ac.*
    FROM abandoned_carts ac
    WHERE ac.email IS NOT NULL
      AND btrim(ac.email) != ''
      AND ac.step_abandoned >= 2
      AND (ac.is_converted IS NULL OR ac.is_converted = false)
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl WHERE sl.abandoned_cart_id = ac.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl
        WHERE lower(btrim(sl.email)) = lower(btrim(ac.email))
      )
    ORDER BY ac.created_at ASC
  LOOP
    v_clean_email := lower(btrim(v_cart.email));
    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
    v_is_recent := (v_cart.created_at >= (now() - interval '2 days'));
    v_is_callback := COALESCE((v_cart.cart_metadata->>'request_type') = 'urgent_callback', false);
    v_derived_source := public.derive_lead_source(v_cart.cart_metadata);

    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    IF NOT v_is_recent THEN
      SELECT id INTO v_terminal_id
      FROM sales_leads
      WHERE lower(btrim(email)) = v_clean_email
        AND status IN ('converted', 'lost', 'fake_lead')
      LIMIT 1;

      IF v_terminal_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    BEGIN
      v_assigned_agent := public.get_next_sales_user();

      INSERT INTO public.sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, step_two_completed_at,
        abandoned_cart_id, created_at, updated_at, last_activity_date,
        resubmission_count, assigned_to, assigned_at, is_callback
      ) VALUES (
        v_first_name, v_last_name, v_clean_email, NULLIF(btrim(v_cart.phone), ''),
        v_derived_source,
        (CASE WHEN v_is_callback THEN 'urgent_callback' ELSE 'new' END)::lead_status,
        CASE WHEN v_is_callback THEN 'high' ELSE 'medium' END,
        NULLIF(btrim(v_cart.vehicle_reg), ''), NULLIF(btrim(v_cart.vehicle_make), ''),
        NULLIF(btrim(v_cart.vehicle_model), ''), NULLIF(btrim(v_cart.vehicle_year), ''),
        NULLIF(btrim(v_cart.vehicle_type), ''),
        NULLIF(btrim(v_cart.mileage), ''), v_cart.plan_name, v_cart.total_price,
        CASE WHEN COALESCE(v_cart.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
        v_cart.id, now(), now(), now(),
        0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END,
        v_is_callback
      );

      IF v_assigned_agent IS NOT NULL THEN
        UPDATE agent_distribution_caps
        SET assigned_today = assigned_today + 1,
            last_assigned_at = now(),
            updated_at = now()
        WHERE admin_user_id = v_assigned_agent;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
      VALUES ('orphan_recovery_failed', 'recover_orphaned_leads',
        jsonb_build_object('cart_id', v_cart.id, 'email', v_clean_email),
        SQLERRM);
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('recovered', v_count, 'skipped', v_skipped);
END;
$function$;
