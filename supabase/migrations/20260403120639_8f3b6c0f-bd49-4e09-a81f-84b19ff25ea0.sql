-- Fix auto_create_lead_from_cart: remove contact_notes references
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

  PERFORM reset_daily_caps();

  -- PRIORITY CHECK: Find ANY worked/assigned lead (no time limit)
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

  -- STANDARD DEDUP (7-day window for unworked leads)
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

  -- TERMINAL GUARD
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

  -- INSERT new lead
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

-- Fix protect_worked_lead_assignment: remove contact_notes reference
CREATE OR REPLACE FUNCTION public.protect_worked_lead_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  IF OLD.assigned_to IS NOT NULL
    AND (
      OLD.status NOT IN ('new')
      OR COALESCE(OLD.call_count, 0) > 0
      OR (OLD.notes IS NOT NULL AND OLD.notes != '')
    )
  THEN
    IF auth.uid() IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    IF NEW.lead_source = 'google_ad' AND NEW.status = 'converted' THEN
      RETURN NEW;
    END IF;
    
    NEW.assigned_to := OLD.assigned_to;
    NEW.assigned_at := OLD.assigned_at;
  END IF;

  RETURN NEW;
END;
$function$;

-- Fix restore_lead_to_snapshot: remove contact_notes reference
CREATE OR REPLACE FUNCTION public.restore_lead_to_snapshot(p_changelog_id uuid, p_restored_by uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_changelog RECORD;
  v_snapshot jsonb;
BEGIN
  SELECT * INTO v_changelog FROM sales_leads_changelog WHERE id = p_changelog_id;
  
  IF v_changelog IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Changelog entry not found');
  END IF;
  
  IF v_changelog.change_type = 'update' THEN
    v_snapshot := v_changelog.old_record;
  ELSE
    v_snapshot := v_changelog.new_record;
  END IF;
  
  IF v_snapshot IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No snapshot data available for this entry');
  END IF;
  
  UPDATE sales_leads
  SET 
    assigned_to = (v_snapshot->>'assigned_to')::uuid,
    status = v_snapshot->>'status',
    notes = v_snapshot->>'notes',
    priority = v_snapshot->>'priority',
    call_count = COALESCE((v_snapshot->>'call_count')::integer, 0),
    is_paid = COALESCE((v_snapshot->>'is_paid')::boolean, false),
    payment_amount = (v_snapshot->>'payment_amount')::numeric,
    next_action_type = v_snapshot->>'next_action_type',
    next_action_date = (v_snapshot->>'next_action_date')::timestamptz,
    updated_at = now()
  WHERE id = v_changelog.lead_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'lead_id', v_changelog.lead_id,
    'restored_to', v_changelog.changed_at,
    'message', 'Lead restored successfully'
  );
END;
$function$;