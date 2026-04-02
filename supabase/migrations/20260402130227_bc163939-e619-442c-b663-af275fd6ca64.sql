
-- 1) Update auto_create_lead_from_cart to protect worked leads from duplication
-- Add a broader dedup check BEFORE the 7-day window checks
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
  v_worked_lead_id UUID;
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

  -- =====================================================
  -- PRIORITY CHECK: Find ANY worked lead (no time limit)
  -- A "worked" lead has been contacted, has notes, or call_count > 0
  -- This prevents leads from jumping between agents
  -- =====================================================
  
  -- Check by phone first (most reliable)
  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_worked_lead_id
    FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND assigned_to IS NOT NULL
      AND (
        status NOT IN ('new', 'converted', 'lost', 'fake_lead')
        OR COALESCE(call_count, 0) > 0
        OR notes IS NOT NULL AND notes != ''
        OR contact_notes IS NOT NULL AND contact_notes != ''
      )
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_worked_lead_id IS NOT NULL THEN
      -- Update the worked lead but NEVER change assigned_to
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

  -- Check by email (no time limit for worked leads)
  SELECT id INTO v_worked_lead_id
  FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND assigned_to IS NOT NULL
    AND (
      status NOT IN ('new', 'converted', 'lost', 'fake_lead')
      OR COALESCE(call_count, 0) > 0
      OR notes IS NOT NULL AND notes != ''
      OR contact_notes IS NOT NULL AND contact_notes != ''
    )
  ORDER BY updated_at DESC
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

  -- =====================================================
  -- STANDARD DEDUP (7-day window for unworked leads)
  -- =====================================================

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

  -- 5+6) INSERT new lead — let the INSERT trigger handle assignment
  BEGIN
    INSERT INTO public.sales_leads (
      first_name, last_name, email, phone, lead_source, status, priority,
      vehicle_reg, vehicle_make, vehicle_model, vehicle_year, vehicle_type,
      mileage, plan_interest, cart_value, step_two_completed_at,
      abandoned_cart_id, created_at, updated_at, last_activity_date,
      resubmission_count
    ) VALUES (
      v_first_name, v_last_name, v_clean_email, NULLIF(btrim(NEW.phone), ''),
      v_derived_source, 'new'::lead_status, 'medium',
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
    VALUES ('lead_creation_failed', 'auto_create_lead_trigger',
      jsonb_build_object('cart_id', NEW.id, 'email', v_clean_email, 'phone', NEW.phone),
      SQLERRM);
  END;

  RETURN NEW;
END;
$function$;

-- 2) Add protection trigger: prevent automated reassignment of worked leads
CREATE OR REPLACE FUNCTION public.protect_worked_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when assigned_to is being changed
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Allow the assign_lead_to_agent RPC (manual assignment) - it uses auth.uid()
  -- Allow changes by authenticated users (manual actions via RPC)
  -- Block only automated trigger-based reassignment
  
  -- If the lead has been worked on (status beyond 'new', has notes, or call count > 0)
  -- AND already has an agent assigned, protect it
  IF OLD.assigned_to IS NOT NULL
    AND (
      OLD.status NOT IN ('new')
      OR COALESCE(OLD.call_count, 0) > 0
      OR (OLD.notes IS NOT NULL AND OLD.notes != '')
      OR (OLD.contact_notes IS NOT NULL AND OLD.contact_notes != '')
    )
  THEN
    -- Allow if this is from the assign_lead_to_agent RPC (has auth context)
    -- or from auto_reassign_google_ad_conversion (status = converted + google_ad)
    IF auth.uid() IS NOT NULL THEN
      -- Manual action by authenticated user - allow
      RETURN NEW;
    END IF;
    
    -- Allow Google Ads auto-reassignment (converted google_ad leads go to Website)
    IF NEW.lead_source = 'google_ad' AND NEW.status = 'converted' THEN
      RETURN NEW;
    END IF;
    
    -- Block automated reassignment - keep original agent
    NEW.assigned_to := OLD.assigned_to;
    NEW.assigned_at := OLD.assigned_at;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create the trigger (fires BEFORE UPDATE, before other triggers)
DROP TRIGGER IF EXISTS trg_protect_worked_lead_assignment ON public.sales_leads;
CREATE TRIGGER trg_protect_worked_lead_assignment
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW
  EXECUTE FUNCTION protect_worked_lead_assignment();
