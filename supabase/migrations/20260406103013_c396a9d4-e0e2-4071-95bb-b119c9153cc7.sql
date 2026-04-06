
-- 1) Create phone normalization helper
CREATE OR REPLACE FUNCTION public.normalize_uk_phone(raw_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    -- Strip all non-digits first
    WHEN regexp_replace(COALESCE(raw_phone, ''), '[^0-9+]', '', 'g') = '' THEN ''
    -- +44 prefix -> replace with 0
    WHEN regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g') LIKE '44%'
      AND length(regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g')) >= 12
    THEN '0' || substring(regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g') from 3)
    -- Already starts with 0 or other format, just digits
    ELSE regexp_replace(COALESCE(raw_phone, ''), '[^0-9]', '', 'g')
  END;
$$;

-- 2) Recreate auto_create_lead_from_abandoned_cart with fixes
CREATE OR REPLACE FUNCTION public.auto_create_lead_from_abandoned_cart()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_lead_id UUID;
  v_dedup_lead_id UUID;
  v_terminal_lead_id UUID;
  v_worked_lead_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_phone TEXT;
  v_norm_phone TEXT;
  v_clean_email TEXT;
  v_is_temp_email BOOLEAN;
  v_assigned_agent UUID;
  v_derived_source lead_source;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_clean_email := lower(btrim(NEW.email));
  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  v_norm_phone := public.normalize_uk_phone(NEW.phone);
  v_is_temp_email := (v_clean_email LIKE '%@price-match.temp' OR v_clean_email LIKE '%@callback.temp');

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
      email = CASE WHEN v_is_temp_email THEN email ELSE v_clean_email END,
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

  -- 2) WORKED LEAD CHECK BY PHONE (no time limit, normalized phone)
  IF length(v_norm_phone) >= 10 THEN
    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = v_norm_phone
      AND status NOT IN ('converted', 'lost', 'fake_lead')
      AND (
        status != 'new'
        OR COALESCE(call_count, 0) > 0
        OR NULLIF(btrim(COALESCE(notes, '')), '') IS NOT NULL
        OR assigned_to IS NOT NULL
      )
    ORDER BY
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT 1;

    IF v_worked_lead_id IS NOT NULL THEN
      UPDATE public.sales_leads
      SET
        email = CASE WHEN v_is_temp_email THEN email ELSE v_clean_email END,
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
      WHERE id = v_worked_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 2b) WORKED LEAD CHECK BY EMAIL (skip if temp email)
  IF NOT v_is_temp_email THEN
    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE lower(btrim(email)) = v_clean_email
      AND status NOT IN ('converted', 'lost', 'fake_lead')
      AND (
        status != 'new'
        OR COALESCE(call_count, 0) > 0
        OR NULLIF(btrim(COALESCE(notes, '')), '') IS NOT NULL
        OR assigned_to IS NOT NULL
      )
    ORDER BY
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT 1;

    IF v_worked_lead_id IS NOT NULL THEN
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
        abandoned_cart_id = NEW.id,
        lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
        last_activity_date = now(),
        resubmission_count = COALESCE(resubmission_count, 0) + 1,
        last_resubmitted_at = now(),
        updated_at = now()
      WHERE id = v_worked_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) PHONE DEDUP (untouched leads, 7-day window, normalized phone)
  IF length(v_norm_phone) >= 10 THEN
    SELECT id INTO v_dedup_lead_id
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = v_norm_phone
      AND created_at > now() - interval '7 days'
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_dedup_lead_id IS NOT NULL THEN
      UPDATE public.sales_leads
      SET
        email = CASE WHEN v_is_temp_email THEN email ELSE v_clean_email END,
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

  -- 3b) EMAIL DEDUP (skip if temp email)
  IF NOT v_is_temp_email THEN
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
  END IF;

  -- 4) TERMINAL GUARD (normalized phone)
  IF length(v_norm_phone) >= 10 THEN
    SELECT id INTO v_terminal_lead_id
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = v_norm_phone
      AND status IN ('converted', 'lost', 'fake_lead')
    LIMIT 1;
    IF v_terminal_lead_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  IF NOT v_is_temp_email THEN
    SELECT id INTO v_terminal_lead_id
    FROM public.sales_leads
    WHERE lower(btrim(email)) = v_clean_email
      AND status IN ('converted', 'lost', 'fake_lead')
    LIMIT 1;
    IF v_terminal_lead_id IS NOT NULL THEN RETURN NEW; END IF;
  END IF;

  -- 5) Reset daily caps if needed
  PERFORM reset_daily_caps();

  -- 6) INSERT — new lead with round-robin
  BEGIN
    v_assigned_agent := public.get_next_sales_user();

    INSERT INTO public.sales_leads (
      first_name, last_name, email, phone, lead_source, status, priority,
      vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
      mileage, plan_interest, cart_value, step_two_completed_at,
      abandoned_cart_id, created_at, updated_at, last_activity_date,
      resubmission_count, assigned_to, assigned_at
    ) VALUES (
      v_first_name, v_last_name,
      CASE WHEN v_is_temp_email THEN NULL ELSE v_clean_email END,
      NULLIF(btrim(NEW.phone), ''),
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
$$;

-- 3) Recreate recover_orphaned_leads with same fixes
CREATE OR REPLACE FUNCTION public.recover_orphaned_leads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart RECORD;
  v_count INTEGER := 0;
  v_skipped INTEGER := 0;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_norm_phone TEXT;
  v_is_temp_email BOOLEAN;
  v_dedup_lead_id UUID;
  v_terminal_id UUID;
  v_worked_lead_id UUID;
  v_assigned_agent UUID;
  v_is_callback BOOLEAN;
  v_derived_source lead_source;
  v_has_active_policy BOOLEAN := false;
BEGIN
  PERFORM reset_daily_caps();

  FOR v_cart IN
    SELECT ac.*
    FROM public.abandoned_carts ac
    WHERE ac.email IS NOT NULL
      AND btrim(ac.email) != ''
      AND ac.step_abandoned >= 2
      AND (ac.is_converted IS NULL OR ac.is_converted = false)
      AND NOT EXISTS (
        SELECT 1 FROM public.sales_leads sl WHERE sl.abandoned_cart_id = ac.id
      )
    ORDER BY ac.created_at ASC
  LOOP
    v_clean_email := lower(btrim(v_cart.email));
    v_clean_phone := regexp_replace(COALESCE(v_cart.phone, ''), '[^0-9]', '', 'g');
    v_norm_phone := public.normalize_uk_phone(v_cart.phone);
    v_is_temp_email := (v_clean_email LIKE '%@price-match.temp' OR v_clean_email LIKE '%@callback.temp');
    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');
    v_is_callback := COALESCE((v_cart.cart_metadata->>'request_type') = 'urgent_callback', false);
    v_derived_source := public.derive_lead_source(v_cart.cart_metadata);

    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    -- Active policy guard
    IF NOT v_is_temp_email THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.customer_policies cp
        WHERE lower(btrim(cp.email)) = v_clean_email
          AND COALESCE(cp.is_deleted, false) = false
          AND cp.status IN ('active', 'scheduled')
      ) INTO v_has_active_policy;

      IF v_has_active_policy THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Terminal guard by phone (normalized)
    IF length(v_norm_phone) >= 10 THEN
      SELECT id INTO v_terminal_id
      FROM public.sales_leads
      WHERE public.normalize_uk_phone(phone) = v_norm_phone
        AND (
          status IN ('converted', 'lost', 'fake_lead')
          OR COALESCE(is_paid, false) = true
        )
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_terminal_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Terminal guard by email (skip if temp)
    IF NOT v_is_temp_email THEN
      SELECT id INTO v_terminal_id
      FROM public.sales_leads
      WHERE lower(btrim(email)) = v_clean_email
        AND (
          status IN ('converted', 'lost', 'fake_lead')
          OR COALESCE(is_paid, false) = true
        )
      ORDER BY updated_at DESC
      LIMIT 1;

      IF v_terminal_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Worked lead by phone (normalized, no time limit)
    IF length(v_norm_phone) >= 10 THEN
      SELECT id INTO v_worked_lead_id
      FROM public.sales_leads
      WHERE public.normalize_uk_phone(phone) = v_norm_phone
        AND status NOT IN ('converted', 'lost', 'fake_lead')
        AND (
          assigned_to IS NOT NULL
          OR status != 'new'
          OR COALESCE(call_count, 0) > 0
          OR NULLIF(btrim(COALESCE(notes, '')), '') IS NOT NULL
        )
      ORDER BY
        CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1;

      IF v_worked_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          email = CASE WHEN v_is_temp_email THEN email ELSE COALESCE(NULLIF(v_clean_email, ''), email) END,
          first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
          last_name = COALESCE(v_last_name, last_name),
          vehicle_reg = COALESCE(NULLIF(btrim(v_cart.vehicle_reg), ''), vehicle_reg),
          vehicle_make = COALESCE(NULLIF(btrim(v_cart.vehicle_make), ''), vehicle_make),
          vehicle_model = COALESCE(NULLIF(btrim(v_cart.vehicle_model), ''), vehicle_model),
          vehicle_year = COALESCE(NULLIF(btrim(v_cart.vehicle_year), ''), vehicle_year),
          vehicle_type = COALESCE(NULLIF(btrim(v_cart.vehicle_type), ''), vehicle_type),
          mileage = COALESCE(NULLIF(btrim(v_cart.mileage), ''), mileage),
          plan_interest = COALESCE(v_cart.plan_name, plan_interest),
          cart_value = COALESCE(v_cart.total_price, cart_value),
          abandoned_cart_id = v_cart.id,
          lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
          last_activity_date = now(),
          resubmission_count = COALESCE(resubmission_count, 0) + 1,
          last_resubmitted_at = now(),
          updated_at = now()
        WHERE id = v_worked_lead_id;

        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Worked lead by email (skip if temp)
    IF NOT v_is_temp_email THEN
      SELECT id INTO v_worked_lead_id
      FROM public.sales_leads
      WHERE lower(btrim(email)) = v_clean_email
        AND status NOT IN ('converted', 'lost', 'fake_lead')
        AND (
          assigned_to IS NOT NULL
          OR status != 'new'
          OR COALESCE(call_count, 0) > 0
          OR NULLIF(btrim(COALESCE(notes, '')), '') IS NOT NULL
        )
      ORDER BY
        CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1;

      IF v_worked_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          phone = COALESCE(NULLIF(btrim(v_cart.phone), ''), phone),
          first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
          last_name = COALESCE(v_last_name, last_name),
          vehicle_reg = COALESCE(NULLIF(btrim(v_cart.vehicle_reg), ''), vehicle_reg),
          vehicle_make = COALESCE(NULLIF(btrim(v_cart.vehicle_make), ''), vehicle_make),
          vehicle_model = COALESCE(NULLIF(btrim(v_cart.vehicle_model), ''), vehicle_model),
          vehicle_year = COALESCE(NULLIF(btrim(v_cart.vehicle_year), ''), vehicle_year),
          vehicle_type = COALESCE(NULLIF(btrim(v_cart.vehicle_type), ''), vehicle_type),
          mileage = COALESCE(NULLIF(btrim(v_cart.mileage), ''), mileage),
          plan_interest = COALESCE(v_cart.plan_name, plan_interest),
          cart_value = COALESCE(v_cart.total_price, cart_value),
          abandoned_cart_id = v_cart.id,
          lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
          last_activity_date = now(),
          resubmission_count = COALESCE(resubmission_count, 0) + 1,
          last_resubmitted_at = now(),
          updated_at = now()
        WHERE id = v_worked_lead_id;

        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Phone dedup (7-day, normalized)
    IF length(v_norm_phone) >= 10 THEN
      SELECT id INTO v_dedup_lead_id
      FROM public.sales_leads
      WHERE public.normalize_uk_phone(phone) = v_norm_phone
        AND created_at > now() - interval '7 days'
        AND status NOT IN ('converted', 'lost', 'fake_lead')
        AND COALESCE(is_paid, false) = false
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_dedup_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          email = CASE WHEN v_is_temp_email THEN email ELSE COALESCE(NULLIF(v_clean_email, ''), email) END,
          first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
          last_name = COALESCE(v_last_name, last_name),
          vehicle_reg = COALESCE(NULLIF(btrim(v_cart.vehicle_reg), ''), vehicle_reg),
          vehicle_make = COALESCE(NULLIF(btrim(v_cart.vehicle_make), ''), vehicle_make),
          vehicle_model = COALESCE(NULLIF(btrim(v_cart.vehicle_model), ''), vehicle_model),
          vehicle_year = COALESCE(NULLIF(btrim(v_cart.vehicle_year), ''), vehicle_year),
          vehicle_type = COALESCE(NULLIF(btrim(v_cart.vehicle_type), ''), vehicle_type),
          mileage = COALESCE(NULLIF(btrim(v_cart.mileage), ''), mileage),
          plan_interest = COALESCE(v_cart.plan_name, plan_interest),
          cart_value = COALESCE(v_cart.total_price, cart_value),
          abandoned_cart_id = v_cart.id,
          lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
          last_activity_date = now(),
          resubmission_count = COALESCE(resubmission_count, 0) + 1,
          last_resubmitted_at = now(),
          updated_at = now()
        WHERE id = v_dedup_lead_id;

        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Email dedup (7-day, skip if temp)
    IF NOT v_is_temp_email THEN
      SELECT id INTO v_dedup_lead_id
      FROM public.sales_leads
      WHERE lower(btrim(email)) = v_clean_email
        AND created_at > now() - interval '7 days'
        AND status NOT IN ('converted', 'lost', 'fake_lead')
        AND COALESCE(is_paid, false) = false
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_dedup_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          phone = COALESCE(NULLIF(btrim(v_cart.phone), ''), phone),
          first_name = COALESCE(NULLIF(v_first_name, ''), first_name),
          last_name = COALESCE(v_last_name, last_name),
          vehicle_reg = COALESCE(NULLIF(btrim(v_cart.vehicle_reg), ''), vehicle_reg),
          vehicle_make = COALESCE(NULLIF(btrim(v_cart.vehicle_make), ''), vehicle_make),
          vehicle_model = COALESCE(NULLIF(btrim(v_cart.vehicle_model), ''), vehicle_model),
          vehicle_year = COALESCE(NULLIF(btrim(v_cart.vehicle_year), ''), vehicle_year),
          vehicle_type = COALESCE(NULLIF(btrim(v_cart.vehicle_type), ''), vehicle_type),
          mileage = COALESCE(NULLIF(btrim(v_cart.mileage), ''), mileage),
          plan_interest = COALESCE(v_cart.plan_name, plan_interest),
          cart_value = COALESCE(v_cart.total_price, cart_value),
          abandoned_cart_id = v_cart.id,
          lead_source = CASE WHEN v_derived_source != 'website' THEN v_derived_source ELSE lead_source END,
          last_activity_date = now(),
          resubmission_count = COALESCE(resubmission_count, 0) + 1,
          last_resubmitted_at = now(),
          updated_at = now()
        WHERE id = v_dedup_lead_id;

        v_count := v_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- New lead insertion
    BEGIN
      v_assigned_agent := public.get_next_sales_user();

      INSERT INTO public.sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, step_two_completed_at,
        abandoned_cart_id, created_at, updated_at, last_activity_date,
        resubmission_count, assigned_to, assigned_at, is_callback
      ) VALUES (
        v_first_name, v_last_name,
        CASE WHEN v_is_temp_email THEN NULL ELSE v_clean_email END,
        NULLIF(btrim(v_cart.phone), ''),
        v_derived_source,
        (CASE WHEN v_is_callback THEN 'urgent_callback' ELSE 'new' END)::lead_status,
        (CASE WHEN v_is_callback THEN 'high' ELSE 'medium' END)::lead_priority,
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
        UPDATE public.agent_distribution_caps
        SET assigned_today = assigned_today + 1,
            last_assigned_at = now(),
            updated_at = now()
        WHERE admin_user_id = v_assigned_agent;
      END IF;

      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.system_event_logs (event_type, event_source, event_data, error_message)
      VALUES (
        'orphan_recovery_failed',
        'recover_orphaned_leads',
        jsonb_build_object('cart_id', v_cart.id, 'email', v_clean_email),
        SQLERRM
      );
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('recovered', v_count, 'skipped', v_skipped);
END;
$$;
