
-- 1) Add functional index on normalized phone for fast dedup lookups in trigger
CREATE INDEX IF NOT EXISTS idx_sales_leads_norm_phone 
ON public.sales_leads (public.normalize_uk_phone(phone))
WHERE phone IS NOT NULL AND btrim(phone) != '';

-- 2) Add index on email for dedup lookups
CREATE INDEX IF NOT EXISTS idx_sales_leads_email_lower 
ON public.sales_leads (lower(btrim(email)))
WHERE email IS NOT NULL AND btrim(email) != '';

-- 3) Add index on abandoned_cart_id for idempotency check
CREATE INDEX IF NOT EXISTS idx_sales_leads_abandoned_cart_id 
ON public.sales_leads (abandoned_cart_id)
WHERE abandoned_cart_id IS NOT NULL;

-- 4) Update trigger to add catch-all dedup guard before INSERT
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

  -- 3) CATCH-ALL PHONE DEDUP — ANY existing lead with same phone, no time limit
  -- This is the final safety net before creating a new lead
  IF length(v_norm_phone) >= 10 THEN
    SELECT id INTO v_dedup_lead_id
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = v_norm_phone
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC
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

  -- 3b) CATCH-ALL EMAIL DEDUP (skip if temp email)
  IF NOT v_is_temp_email THEN
    SELECT id INTO v_dedup_lead_id
    FROM public.sales_leads
    WHERE lower(btrim(email)) = v_clean_email
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC
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

-- 5) Clean up existing duplicates: merge into the lead with most activity, delete the rest
-- For each phone with >1 lead, keep the one with highest priority (assigned+worked > assigned > new)
DO $$
DECLARE
  dup_rec RECORD;
  keep_id UUID;
  delete_ids UUID[];
BEGIN
  FOR dup_rec IN
    SELECT public.normalize_uk_phone(phone) as norm_phone
    FROM public.sales_leads
    WHERE phone IS NOT NULL AND btrim(phone) != ''
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    GROUP BY public.normalize_uk_phone(phone)
    HAVING COUNT(*) > 1
  LOOP
    -- Pick the best lead to keep: most activity wins
    SELECT id INTO keep_id
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = dup_rec.norm_phone
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY
      -- Prefer leads with agent work
      CASE WHEN status != 'new' THEN 0 ELSE 1 END,
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      COALESCE(call_count, 0) DESC,
      COALESCE(resubmission_count, 0) DESC,
      updated_at DESC
    LIMIT 1;

    -- Get IDs to delete
    SELECT array_agg(id) INTO delete_ids
    FROM public.sales_leads
    WHERE public.normalize_uk_phone(phone) = dup_rec.norm_phone
      AND status NOT IN ('converted', 'lost', 'fake_lead')
      AND id != keep_id;

    -- Mark the kept lead as recreated
    UPDATE public.sales_leads
    SET is_recreated = TRUE,
        resubmission_count = COALESCE(resubmission_count, 0) + array_length(delete_ids, 1)
    WHERE id = keep_id;

    -- Delete duplicates (their notes will cascade if FK exists, otherwise just delete leads)
    DELETE FROM public.sales_leads WHERE id = ANY(delete_ids);
  END LOOP;
END $$;
