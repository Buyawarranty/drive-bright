
-- 1. Create system_event_logs table for trigger error logging
CREATE TABLE IF NOT EXISTS public.system_event_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  event_source TEXT,
  event_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin users can view system logs"
  ON public.system_event_logs FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true));

-- 2. Create recover_orphaned_leads() function
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
  v_existing_id UUID;
  v_terminal_id UUID;
  v_assigned_agent UUID;
BEGIN
  -- Reset daily caps first
  PERFORM reset_daily_caps();

  FOR v_cart IN
    SELECT ac.*
    FROM abandoned_carts ac
    WHERE ac.email IS NOT NULL
      AND btrim(ac.email) != ''
      AND ac.step_abandoned >= 2
      AND ac.is_converted = false
      -- No sales_lead linked by abandoned_cart_id
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl WHERE sl.abandoned_cart_id = ac.id
      )
      -- No sales_lead with same email within 7 days
      AND NOT EXISTS (
        SELECT 1 FROM sales_leads sl
        WHERE lower(btrim(sl.email)) = lower(btrim(ac.email))
          AND sl.created_at > ac.created_at - interval '7 days'
      )
    ORDER BY ac.created_at ASC
  LOOP
    v_clean_email := lower(btrim(v_cart.email));
    v_clean_phone := regexp_replace(COALESCE(v_cart.phone, ''), '[^0-9]', '', 'g');
    v_full_name := NULLIF(btrim(COALESCE(v_cart.full_name, '')), '');

    IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
      v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
      v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
    ELSE
      v_first_name := NULL;
      v_last_name := NULL;
    END IF;

    -- Terminal guard: skip if a terminal lead exists for this email
    SELECT id INTO v_terminal_id
    FROM sales_leads
    WHERE lower(btrim(email)) = v_clean_email
      AND status IN ('converted', 'lost', 'fake_lead')
    LIMIT 1;

    IF v_terminal_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Terminal guard: phone
    IF length(v_clean_phone) >= 10 THEN
      SELECT id INTO v_terminal_id
      FROM sales_leads
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        AND status IN ('converted', 'lost', 'fake_lead')
      LIMIT 1;

      IF v_terminal_id IS NOT NULL THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Get next agent via round-robin
    BEGIN
      v_assigned_agent := public.get_next_sales_user();
    EXCEPTION WHEN OTHERS THEN
      v_assigned_agent := NULL;
    END;

    -- Insert the missing sales_lead
    BEGIN
      INSERT INTO public.sales_leads (
        first_name, last_name, email, phone, lead_source, status, priority,
        vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
        mileage, plan_interest, cart_value, step_two_completed_at,
        abandoned_cart_id, created_at, updated_at, last_activity_date,
        resubmission_count, assigned_to, assigned_at
      ) VALUES (
        v_first_name, v_last_name, v_clean_email, NULLIF(btrim(v_cart.phone), ''),
        'website', 'new', 'medium',
        NULLIF(btrim(v_cart.vehicle_reg), ''), NULLIF(btrim(v_cart.vehicle_make), ''),
        NULLIF(btrim(v_cart.vehicle_model), ''), NULLIF(btrim(v_cart.vehicle_year), ''),
        NULLIF(btrim(v_cart.vehicle_type), ''),
        NULLIF(btrim(v_cart.mileage), ''), v_cart.plan_name, v_cart.total_price,
        CASE WHEN COALESCE(v_cart.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
        v_cart.id, COALESCE(v_cart.created_at, now()), now(), now(),
        0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END
      );

      -- Increment agent counter
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
      VALUES ('lead_recovery_error', 'recover_orphaned_leads', 
        jsonb_build_object('cart_id', v_cart.id, 'email', v_clean_email),
        SQLERRM);
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  -- Log the recovery run
  INSERT INTO system_event_logs (event_type, event_source, event_data)
  VALUES ('lead_recovery_run', 'recover_orphaned_leads',
    jsonb_build_object('recovered', v_count, 'skipped', v_skipped, 'ran_at', now()));

  RETURN jsonb_build_object('success', true, 'recovered', v_count, 'skipped', v_skipped);
END;
$function$;

-- 3. Add safety net to existing trigger: wrap INSERT in exception handler
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
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_clean_email := lower(btrim(NEW.email));

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL;
    v_last_name := NULL;
  END IF;

  -- 1) IDEMPOTENCY: existing lead linked to this cart (non-terminal)
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
      last_activity_date = now(),
      updated_at = now()
    WHERE id = v_existing_lead_id;
    RETURN NEW;
  END IF;

  -- 2) PHONE DEDUP: Same phone within 7 days
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
        last_activity_date = now(),
        resubmission_count = COALESCE(resubmission_count, 0) + 1,
        last_resubmitted_at = now(),
        updated_at = now()
      WHERE id = v_dedup_lead_id;
      RETURN NEW;
    END IF;
  END IF;

  -- 3) EMAIL DEDUP: Same email within 7 days
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

  -- 5) ROUND-ROBIN ASSIGNMENT with safety net
  BEGIN
    v_assigned_agent := public.get_next_sales_user();
  EXCEPTION WHEN OTHERS THEN
    v_assigned_agent := NULL;
    INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
    VALUES ('agent_assignment_error', 'auto_create_lead_trigger',
      jsonb_build_object('cart_id', NEW.id, 'email', v_clean_email),
      SQLERRM);
  END;

  -- 6) NEW LEAD with auto-assignment (wrapped in safety net)
  BEGIN
    INSERT INTO public.sales_leads (
      first_name, last_name, email, phone, lead_source, status, priority,
      vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
      mileage, plan_interest, cart_value, step_two_completed_at,
      abandoned_cart_id, created_at, updated_at, last_activity_date,
      resubmission_count, assigned_to, assigned_at
    ) VALUES (
      v_first_name, v_last_name, v_clean_email, NULLIF(btrim(NEW.phone), ''),
      'website', 'new', 'medium',
      NULLIF(btrim(NEW.vehicle_reg), ''), NULLIF(btrim(NEW.vehicle_make), ''),
      NULLIF(btrim(NEW.vehicle_model), ''), NULLIF(btrim(NEW.vehicle_year), ''),
      NULLIF(btrim(NEW.vehicle_type), ''),
      NULLIF(btrim(NEW.mileage), ''), NEW.plan_name, NEW.total_price,
      CASE WHEN COALESCE(NEW.step_abandoned, 0) >= 2 THEN now() ELSE NULL END,
      NEW.id, COALESCE(NEW.created_at, now()), now(), now(),
      0, v_assigned_agent, CASE WHEN v_assigned_agent IS NOT NULL THEN now() ELSE NULL END
    );

    -- 7) INCREMENT the assigned_today counter for the agent
    IF v_assigned_agent IS NOT NULL THEN
      UPDATE public.agent_distribution_caps
      SET assigned_today = assigned_today + 1,
          last_assigned_at = now(),
          updated_at = now()
      WHERE admin_user_id = v_assigned_agent;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- SAFETY NET: Log the error instead of silently failing
    INSERT INTO system_event_logs (event_type, event_source, event_data, error_message)
    VALUES ('lead_creation_failed', 'auto_create_lead_trigger',
      jsonb_build_object('cart_id', NEW.id, 'email', v_clean_email, 'phone', NEW.phone),
      SQLERRM);
  END;

  RETURN NEW;
END;
$function$;
