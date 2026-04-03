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
  v_derived_source lead_source;
  v_worked_lead_id UUID;
  v_has_active_policy BOOLEAN := false;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.step_abandoned, 0) < 2 THEN
    RETURN NEW;
  END IF;

  v_clean_email := lower(btrim(NEW.email));
  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_derived_source := public.derive_lead_source(NEW.cart_metadata);

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customer_policies cp
    WHERE lower(btrim(cp.email)) = v_clean_email
      AND COALESCE(cp.is_deleted, false) = false
      AND cp.status IN ('active', 'scheduled')
  ) INTO v_has_active_policy;

  IF v_has_active_policy THEN
    RETURN NEW;
  END IF;

  PERFORM reset_daily_caps();

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_terminal_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND (
        status IN ('converted', 'lost', 'fake_lead')
        OR COALESCE(is_paid, false) = true
      )
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_terminal_lead_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_terminal_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND (
      status IN ('converted', 'lost', 'fake_lead')
      OR COALESCE(is_paid, false) = true
    )
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_terminal_lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND (
        assigned_to IS NOT NULL
        OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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
      WHERE id = v_worked_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_worked_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND (
      assigned_to IS NOT NULL
      OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_dedup_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND created_at > now() - interval '7 days'
      AND status NOT IN ('converted', 'lost', 'fake_lead')
      AND COALESCE(is_paid, false) = false
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

  BEGIN
    INSERT INTO public.sales_leads (
      first_name, last_name, email, phone, lead_source, status, priority,
      vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
      mileage, plan_interest, cart_value, step_two_completed_at,
      abandoned_cart_id, created_at, updated_at, last_activity_date,
      resubmission_count
    ) VALUES (
      v_first_name, v_last_name, v_clean_email, NULLIF(btrim(NEW.phone), ''),
      v_derived_source, 'new'::lead_status, 'medium'::lead_priority,
      NULLIF(btrim(NEW.vehicle_reg), ''), NULLIF(btrim(NEW.vehicle_make), ''),
      NULLIF(btrim(NEW.vehicle_model), ''), NULLIF(btrim(NEW.vehicle_year), ''),
      NULLIF(btrim(NEW.vehicle_type), ''),
      NULLIF(btrim(NEW.mileage), ''), NEW.plan_name, NEW.total_price,
      CASE WHEN COALESCE(NEW.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
      NEW.id, COALESCE(NEW.created_at, now()), now(), now(),
      0
    );
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
    VALUES (
      'lead_creation_failed',
      'auto_create_lead_trigger',
      jsonb_build_object('cart_id', NEW.id, 'email', v_clean_email, 'phone', NEW.phone),
      SQLERRM
    );
  END;

  RETURN NEW;
END;
$function$;

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
  v_clean_phone TEXT;
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

    IF length(v_clean_phone) >= 10 THEN
      SELECT id INTO v_terminal_id
      FROM public.sales_leads
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
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

    IF length(v_clean_phone) >= 10 THEN
      SELECT id INTO v_worked_lead_id
      FROM public.sales_leads
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        AND (
          assigned_to IS NOT NULL
          OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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
          email = COALESCE(NULLIF(v_clean_email, ''), email),
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

    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE lower(btrim(email)) = v_clean_email
      AND (
        assigned_to IS NOT NULL
        OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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

    IF length(v_clean_phone) >= 10 THEN
      SELECT id INTO v_dedup_lead_id
      FROM public.sales_leads
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        AND created_at > now() - interval '7 days'
        AND status NOT IN ('converted', 'lost', 'fake_lead')
        AND COALESCE(is_paid, false) = false
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_dedup_lead_id IS NOT NULL THEN
        UPDATE public.sales_leads
        SET
          email = COALESCE(NULLIF(v_clean_email, ''), email),
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
$function$;

CREATE OR REPLACE FUNCTION public.recover_single_lead(p_cart_id uuid, p_agent_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cart RECORD;
  v_first_name TEXT;
  v_last_name TEXT;
  v_full_name TEXT;
  v_clean_email TEXT;
  v_clean_phone TEXT;
  v_existing_id UUID;
  v_worked_lead_id UUID;
  v_terminal_id UUID;
  v_assigned_agent UUID;
  v_is_callback BOOLEAN;
  v_derived_source lead_source;
  v_new_lead_id UUID;
  v_has_active_policy BOOLEAN := false;
BEGIN
  PERFORM reset_daily_caps();

  SELECT * INTO v_cart FROM public.abandoned_carts WHERE id = p_cart_id;
  IF v_cart IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cart not found');
  END IF;

  v_clean_email := lower(btrim(v_cart.email));
  v_clean_phone := regexp_replace(COALESCE(v_cart.phone, ''), '[^0-9]', '', 'g');

  SELECT id INTO v_existing_id
  FROM public.sales_leads
  WHERE abandoned_cart_id = p_cart_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead already exists in pipeline', 'lead_id', v_existing_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.customer_policies cp
    WHERE lower(btrim(cp.email)) = v_clean_email
      AND COALESCE(cp.is_deleted, false) = false
      AND cp.status IN ('active', 'scheduled')
  ) INTO v_has_active_policy;

  IF v_has_active_policy THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer already has an active policy');
  END IF;

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_terminal_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND (
        status IN ('converted', 'lost', 'fake_lead')
        OR COALESCE(is_paid, false) = true
      )
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_terminal_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Lead is already closed', 'lead_id', v_terminal_id);
    END IF;
  END IF;

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
    RETURN jsonb_build_object('success', false, 'error', 'Lead is already closed', 'lead_id', v_terminal_id);
  END IF;

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

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND (
        assigned_to IS NOT NULL
        OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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
        email = COALESCE(NULLIF(v_clean_email, ''), email),
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

      RETURN jsonb_build_object('success', true, 'lead_id', v_worked_lead_id, 'updated_existing', true);
    END IF;
  END IF;

  SELECT id INTO v_worked_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND (
      assigned_to IS NOT NULL
      OR status NOT IN ('new', 'converted', 'lost', 'fake_lead')
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

    RETURN jsonb_build_object('success', true, 'lead_id', v_worked_lead_id, 'updated_existing', true);
  END IF;

  IF p_agent_id IS NOT NULL THEN
    v_assigned_agent := p_agent_id;
  ELSE
    v_assigned_agent := public.get_next_sales_user();
  END IF;

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
    (CASE WHEN v_is_callback THEN 'high' ELSE 'medium' END)::lead_priority,
    NULLIF(btrim(v_cart.vehicle_reg), ''), NULLIF(btrim(v_cart.vehicle_make), ''),
    NULLIF(btrim(v_cart.vehicle_model), ''), NULLIF(btrim(v_cart.vehicle_year), ''),
    NULLIF(btrim(v_cart.vehicle_type), ''),
    NULLIF(btrim(v_cart.mileage), ''), v_cart.plan_name, v_cart.total_price,
    CASE WHEN COALESCE(v_cart.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
    v_cart.id, now(), now(), now(),
    0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END,
    v_is_callback
  ) RETURNING id INTO v_new_lead_id;

  IF v_assigned_agent IS NOT NULL THEN
    UPDATE public.agent_distribution_caps
    SET assigned_today = assigned_today + 1,
        last_assigned_at = now(),
        updated_at = now()
    WHERE admin_user_id = v_assigned_agent;
  END IF;

  RETURN jsonb_build_object('success', true, 'lead_id', v_new_lead_id, 'assigned_to', v_assigned_agent);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.system_event_logs (event_type, event_source, event_data, error_message)
  VALUES (
    'single_lead_recovery_failed',
    'recover_single_lead',
    jsonb_build_object('cart_id', p_cart_id, 'agent_id', p_agent_id),
    SQLERRM
  );
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;