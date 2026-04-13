
CREATE OR REPLACE FUNCTION public.recover_leads_from_step2(p_lookback_hours integer DEFAULT 48)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_carts INTEGER := 0;
  v_updated_leads INTEGER := 0;
  v_created_carts INTEGER := 0;
  v_duplicates_found INTEGER := 0;
  v_rec RECORD;
  v_existing_lead_id UUID;
  v_clean_phone TEXT;
BEGIN
  -- Step 1: Backfill missing data on existing abandoned_carts from step2
  WITH step2_data AS (
    SELECT DISTINCT ON (lower(btrim(email)))
      lower(btrim(email)) as email, first_name, phone, vehicle_reg, 
      vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    WHERE created_at >= now() - (p_lookback_hours || ' hours')::interval
    ORDER BY lower(btrim(email)), created_at DESC
  ),
  updated AS (
    UPDATE abandoned_carts ac
    SET 
      full_name = COALESCE(NULLIF(btrim(ac.full_name), ''), s2.first_name, ac.full_name),
      phone = COALESCE(NULLIF(btrim(ac.phone), ''), s2.phone, ac.phone),
      vehicle_reg = COALESCE(NULLIF(btrim(ac.vehicle_reg), ''), s2.vehicle_reg, ac.vehicle_reg),
      vehicle_make = COALESCE(NULLIF(btrim(ac.vehicle_make), ''), s2.vehicle_make, ac.vehicle_make),
      vehicle_model = COALESCE(NULLIF(btrim(ac.vehicle_model), ''), s2.vehicle_model, ac.vehicle_model),
      vehicle_year = COALESCE(NULLIF(btrim(ac.vehicle_year), ''), s2.vehicle_year, ac.vehicle_year),
      mileage = COALESCE(NULLIF(btrim(ac.mileage), ''), s2.mileage, ac.mileage),
      updated_at = now()
    FROM step2_data s2
    WHERE lower(btrim(ac.email)) = s2.email
    AND ac.created_at >= now() - (p_lookback_hours || ' hours')::interval
    AND (
      ac.phone IS NULL OR btrim(ac.phone) = ''
      OR ac.full_name IS NULL OR btrim(ac.full_name) = ''
      OR ac.vehicle_reg IS NULL OR btrim(ac.vehicle_reg) = ''
    )
    RETURNING ac.id
  )
  SELECT count(*) INTO v_updated_carts FROM updated;

  -- Step 2: Backfill missing data on existing sales_leads from step2 (preserve assignments)
  WITH step2_data AS (
    SELECT DISTINCT ON (lower(btrim(email)))
      lower(btrim(email)) as email, first_name, phone, vehicle_reg,
      vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    WHERE created_at >= now() - (p_lookback_hours || ' hours')::interval
    ORDER BY lower(btrim(email)), created_at DESC
  ),
  updated AS (
    UPDATE sales_leads sl
    SET 
      first_name = COALESCE(NULLIF(btrim(sl.first_name), ''), s2.first_name, sl.first_name),
      phone = COALESCE(NULLIF(btrim(sl.phone), ''), s2.phone, sl.phone),
      vehicle_reg = COALESCE(NULLIF(btrim(sl.vehicle_reg), ''), s2.vehicle_reg, sl.vehicle_reg),
      vehicle_make = COALESCE(NULLIF(btrim(sl.vehicle_make), ''), s2.vehicle_make, sl.vehicle_make),
      vehicle_model = COALESCE(NULLIF(btrim(sl.vehicle_model), ''), s2.vehicle_model, sl.vehicle_model),
      vehicle_year = COALESCE(NULLIF(btrim(sl.vehicle_year), ''), s2.vehicle_year, sl.vehicle_year),
      mileage = COALESCE(NULLIF(btrim(sl.mileage), ''), s2.mileage, sl.mileage),
      updated_at = now()
      -- NOTE: assigned_to is NEVER touched - original assignment preserved
    FROM step2_data s2
    WHERE lower(btrim(sl.email)) = s2.email
    AND (
      sl.phone IS NULL OR btrim(sl.phone) = ''
      OR sl.first_name IS NULL OR btrim(sl.first_name) = ''
      OR sl.vehicle_reg IS NULL OR btrim(sl.vehicle_reg) = ''
    )
    RETURNING sl.id
  )
  SELECT count(*) INTO v_updated_leads FROM updated;

  -- Step 3: Create missing abandoned_carts only for truly new leads
  -- Check by BOTH email AND phone (last 10 digits) to prevent duplicates
  FOR v_rec IN
    SELECT DISTINCT ON (lower(btrim(s2.email)))
      lower(btrim(s2.email)) as email, s2.first_name, s2.phone, s2.vehicle_reg,
      s2.vehicle_make, s2.vehicle_model, s2.vehicle_year, s2.mileage
    FROM step2_submission_attempts s2
    WHERE s2.created_at >= now() - (p_lookback_hours || ' hours')::interval
    AND NOT EXISTS (
      SELECT 1 FROM abandoned_carts ac 
      WHERE lower(btrim(ac.email)) = lower(btrim(s2.email))
      AND ac.created_at >= now() - (p_lookback_hours || ' hours')::interval
    )
    ORDER BY lower(btrim(s2.email)), s2.created_at DESC
  LOOP
    v_clean_phone := regexp_replace(COALESCE(v_rec.phone, ''), '[^0-9]', '', 'g');
    v_existing_lead_id := NULL;

    -- Check if a lead already exists by email (any time range)
    SELECT id INTO v_existing_lead_id
    FROM sales_leads
    WHERE lower(btrim(email)) = v_rec.email
      AND status NOT IN ('converted', 'lost', 'fake_lead')
    ORDER BY 
      CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
      updated_at DESC
    LIMIT 1;

    -- Also check by phone if no email match
    IF v_existing_lead_id IS NULL AND length(v_clean_phone) >= 10 THEN
      SELECT id INTO v_existing_lead_id
      FROM sales_leads
      WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = v_clean_phone
        AND status NOT IN ('converted', 'lost', 'fake_lead')
      ORDER BY 
        CASE WHEN assigned_to IS NOT NULL THEN 0 ELSE 1 END,
        updated_at DESC
      LIMIT 1;
    END IF;

    IF v_existing_lead_id IS NOT NULL THEN
      -- Duplicate found: update existing lead, preserve assignment, increment resubmission count
      UPDATE sales_leads
      SET
        first_name = COALESCE(NULLIF(btrim(first_name), ''), v_rec.first_name, first_name),
        phone = COALESCE(NULLIF(btrim(phone), ''), v_rec.phone, phone),
        vehicle_reg = COALESCE(NULLIF(btrim(vehicle_reg), ''), v_rec.vehicle_reg, vehicle_reg),
        vehicle_make = COALESCE(NULLIF(btrim(vehicle_make), ''), v_rec.vehicle_make, vehicle_make),
        vehicle_model = COALESCE(NULLIF(btrim(vehicle_model), ''), v_rec.vehicle_model, vehicle_model),
        resubmission_count = COALESCE(resubmission_count, 0) + 1,
        last_resubmitted_at = now(),
        last_activity_date = now(),
        updated_at = now()
        -- assigned_to is NEVER changed
      WHERE id = v_existing_lead_id;
      
      v_duplicates_found := v_duplicates_found + 1;
    ELSE
      -- Truly new: create abandoned cart (triggers lead creation via trg_auto_create_lead_from_cart)
      INSERT INTO abandoned_carts (
        email, full_name, phone, vehicle_reg, vehicle_make, vehicle_model,
        vehicle_year, mileage, step_abandoned, created_at, updated_at
      ) VALUES (
        v_rec.email, v_rec.first_name, v_rec.phone, v_rec.vehicle_reg,
        v_rec.vehicle_make, v_rec.vehicle_model, v_rec.vehicle_year,
        v_rec.mileage, 2, now(), now()
      );
      v_created_carts := v_created_carts + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_carts', v_updated_carts,
    'updated_leads', v_updated_leads,
    'created_new', v_created_carts,
    'duplicates_merged', v_duplicates_found,
    'lookback_hours', p_lookback_hours
  );
END;
$$;
