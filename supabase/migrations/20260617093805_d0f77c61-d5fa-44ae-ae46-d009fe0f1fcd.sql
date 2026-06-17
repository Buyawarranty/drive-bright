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
  v_assigned_auth_uid UUID;
  v_derived_source lead_source;
  v_lock_key BIGINT;
BEGIN
  IF NEW.email IS NULL OR btrim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  v_full_name := NULLIF(btrim(COALESCE(NEW.full_name, '')), '');
  v_clean_email := lower(btrim(NEW.email));
  v_derived_source := public.derive_lead_source(NEW.cart_metadata);

  IF v_full_name IS NOT NULL AND position('@' in v_full_name) = 0 THEN
    v_first_name := NULLIF(split_part(v_full_name, ' ', 1), '');
    v_last_name := NULLIF(btrim(substring(v_full_name from char_length(COALESCE(v_first_name, '')) + 1)), '');
  ELSE
    v_first_name := NULL; v_last_name := NULL;
  END IF;

  v_lock_key := hashtext(v_clean_email);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT id INTO v_existing_lead_id FROM public.sales_leads
  WHERE abandoned_cart_id = NEW.id AND status NOT IN ('converted','lost','fake_lead') LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET email = v_clean_email,
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
      last_activity_date = now(), updated_at = now()
    WHERE id = v_existing_lead_id
    RETURNING assigned_to INTO v_assigned_agent;

    IF v_assigned_agent IS NOT NULL THEN
      SELECT user_id INTO v_assigned_auth_uid FROM public.admin_users WHERE id = v_assigned_agent;
      IF v_assigned_auth_uid IS NOT NULL THEN
        UPDATE public.abandoned_carts SET contacted_by = v_assigned_auth_uid
        WHERE id = NEW.id AND (contacted_by IS NULL OR contacted_by != v_assigned_auth_uid);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  v_clean_phone := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_terminal_lead_id FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND status IN ('converted','lost','fake_lead') LIMIT 1;
    IF v_terminal_lead_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_terminal_lead_id FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND status IN ('converted','lost','fake_lead') LIMIT 1;
  IF v_terminal_lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF length(v_clean_phone) >= 10 THEN
    SELECT id INTO v_dedup_lead_id FROM public.sales_leads
    WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
      AND status NOT IN ('converted','lost','fake_lead')
      AND (created_at > now() - interval '7 days' OR assigned_to IS NOT NULL OR call_count > 0 OR notes IS NOT NULL)
    ORDER BY CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 1;

    IF v_dedup_lead_id IS NOT NULL THEN
      UPDATE public.sales_leads
      SET email = v_clean_email,
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
        last_resubmitted_at = now(), updated_at = now()
      WHERE id = v_dedup_lead_id
      RETURNING assigned_to INTO v_assigned_agent;

      IF v_assigned_agent IS NOT NULL THEN
        SELECT user_id INTO v_assigned_auth_uid FROM public.admin_users WHERE id = v_assigned_agent;
        IF v_assigned_auth_uid IS NOT NULL THEN
          UPDATE public.abandoned_carts SET contacted_by = v_assigned_auth_uid
          WHERE id = NEW.id AND (contacted_by IS NULL OR contacted_by != v_assigned_auth_uid);
        END IF;
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_dedup_lead_id FROM public.sales_leads
  WHERE lower(btrim(email)) = v_clean_email
    AND status NOT IN ('converted','lost','fake_lead')
    AND (created_at > now() - interval '7 days' OR assigned_to IS NOT NULL OR call_count > 0 OR notes IS NOT NULL)
  ORDER BY CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 1;

  IF v_dedup_lead_id IS NOT NULL THEN
    UPDATE public.sales_leads
    SET phone = COALESCE(NULLIF(btrim(NEW.phone), ''), phone),
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
      last_resubmitted_at = now(), updated_at = now()
    WHERE id = v_dedup_lead_id
    RETURNING assigned_to INTO v_assigned_agent;

    IF v_assigned_agent IS NOT NULL THEN
      SELECT user_id INTO v_assigned_auth_uid FROM public.admin_users WHERE id = v_assigned_agent;
      IF v_assigned_auth_uid IS NOT NULL THEN
        UPDATE public.abandoned_carts SET contacted_by = v_assigned_auth_uid
        WHERE id = NEW.id AND (contacted_by IS NULL OR contacted_by != v_assigned_auth_uid);
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- PHONE-REQUIRED GUARD: a brand-new sales lead must have a phone number.
  -- Without one, agents have nothing to call. Abandoned cart + email
  -- marketing still capture them; they just don't pollute New Leads.
  IF length(v_clean_phone) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.sales_leads (
    email, phone, first_name, last_name, vehicle_reg, vehicle_make, vehicle_model,
    vehicle_year, vehicle_type, mileage, plan_interest, cart_value, abandoned_cart_id,
    lead_source, status, priority, last_activity_date
  ) VALUES (
    v_clean_email, NULLIF(btrim(NEW.phone), ''), v_first_name, v_last_name,
    NULLIF(btrim(NEW.vehicle_reg), ''), NULLIF(btrim(NEW.vehicle_make), ''),
    NULLIF(btrim(NEW.vehicle_model), ''), NULLIF(btrim(NEW.vehicle_year), ''),
    NULLIF(btrim(NEW.vehicle_type), ''), NULLIF(btrim(NEW.mileage), ''),
    NEW.plan_name, NEW.total_price, NEW.id,
    v_derived_source, 'new'::lead_status, 'medium'::lead_priority, now()
  );

  RETURN NEW;
END;
$function$;