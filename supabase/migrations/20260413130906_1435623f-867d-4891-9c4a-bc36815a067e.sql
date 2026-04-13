
-- 1) IMMEDIATE FIX: Update today's broken abandoned_carts with data from step2_submission_attempts
UPDATE abandoned_carts ac
SET 
  full_name = COALESCE(NULLIF(ac.full_name, ''), s2.first_name),
  phone = COALESCE(NULLIF(ac.phone, ''), s2.phone),
  vehicle_reg = COALESCE(NULLIF(ac.vehicle_reg, ''), s2.vehicle_reg),
  vehicle_make = COALESCE(NULLIF(ac.vehicle_make, ''), s2.vehicle_make),
  vehicle_model = COALESCE(NULLIF(ac.vehicle_model, ''), s2.vehicle_model),
  vehicle_year = COALESCE(NULLIF(ac.vehicle_year, ''), s2.vehicle_year),
  mileage = COALESCE(NULLIF(ac.mileage, ''), s2.mileage),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (email) 
    email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
  FROM step2_submission_attempts
  WHERE created_at >= '2026-04-13T00:00:00Z'
  ORDER BY email, created_at DESC
) s2
WHERE ac.email = s2.email
AND ac.created_at >= '2026-04-13T00:00:00Z'
AND (ac.phone IS NULL OR ac.full_name IS NULL OR ac.vehicle_reg IS NULL);

-- 2) IMMEDIATE FIX: Update today's broken sales_leads with data from step2_submission_attempts
UPDATE sales_leads sl
SET 
  first_name = COALESCE(NULLIF(sl.first_name, ''), s2.first_name),
  phone = COALESCE(NULLIF(sl.phone, ''), s2.phone),
  vehicle_reg = COALESCE(NULLIF(sl.vehicle_reg, ''), s2.vehicle_reg),
  vehicle_make = COALESCE(NULLIF(sl.vehicle_make, ''), s2.vehicle_make),
  vehicle_model = COALESCE(NULLIF(sl.vehicle_model, ''), s2.vehicle_model),
  vehicle_year = COALESCE(NULLIF(sl.vehicle_year, ''), s2.vehicle_year),
  mileage = COALESCE(NULLIF(sl.mileage, ''), s2.mileage),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (email) 
    email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
  FROM step2_submission_attempts
  WHERE created_at >= '2026-04-13T00:00:00Z'
  ORDER BY email, created_at DESC
) s2
WHERE sl.email = s2.email
AND sl.created_at >= '2026-04-13T00:00:00Z'
AND (sl.phone IS NULL OR sl.first_name IS NULL OR sl.vehicle_reg IS NULL);

-- 3) Create a robust recovery function for super_admin
CREATE OR REPLACE FUNCTION public.recover_leads_from_step2(
  p_lookback_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_carts INTEGER := 0;
  v_updated_leads INTEGER := 0;
  v_created_carts INTEGER := 0;
  v_rec RECORD;
BEGIN
  -- Step 1: Backfill missing data on existing abandoned_carts from step2
  WITH step2_data AS (
    SELECT DISTINCT ON (email) 
      email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    WHERE created_at >= now() - (p_lookback_hours || ' hours')::interval
    ORDER BY email, created_at DESC
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
    WHERE ac.email = s2.email
    AND ac.created_at >= now() - (p_lookback_hours || ' hours')::interval
    AND (
      ac.phone IS NULL OR btrim(ac.phone) = ''
      OR ac.full_name IS NULL OR btrim(ac.full_name) = ''
      OR ac.vehicle_reg IS NULL OR btrim(ac.vehicle_reg) = ''
    )
    RETURNING ac.id
  )
  SELECT count(*) INTO v_updated_carts FROM updated;

  -- Step 2: Backfill missing data on existing sales_leads from step2
  WITH step2_data AS (
    SELECT DISTINCT ON (email) 
      email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    WHERE created_at >= now() - (p_lookback_hours || ' hours')::interval
    ORDER BY email, created_at DESC
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
    FROM step2_data s2
    WHERE sl.email = s2.email
    AND sl.created_at >= now() - (p_lookback_hours || ' hours')::interval
    AND (
      sl.phone IS NULL OR btrim(sl.phone) = ''
      OR sl.first_name IS NULL OR btrim(sl.first_name) = ''
      OR sl.vehicle_reg IS NULL OR btrim(sl.vehicle_reg) = ''
    )
    RETURNING sl.id
  )
  SELECT count(*) INTO v_updated_leads FROM updated;

  -- Step 3: Create missing abandoned_carts (which auto-triggers lead creation)
  FOR v_rec IN
    SELECT DISTINCT ON (s2.email)
      s2.email, s2.first_name, s2.phone, s2.vehicle_reg,
      s2.vehicle_make, s2.vehicle_model, s2.vehicle_year, s2.mileage
    FROM step2_submission_attempts s2
    WHERE s2.created_at >= now() - (p_lookback_hours || ' hours')::interval
    AND NOT EXISTS (
      SELECT 1 FROM abandoned_carts ac 
      WHERE ac.email = s2.email 
      AND ac.created_at >= now() - (p_lookback_hours || ' hours')::interval
    )
    AND NOT EXISTS (
      SELECT 1 FROM sales_leads sl 
      WHERE sl.email = s2.email 
      AND sl.created_at >= now() - (p_lookback_hours || ' hours')::interval
      AND sl.status NOT IN ('converted', 'lost', 'fake_lead')
    )
    ORDER BY s2.email, s2.created_at DESC
  LOOP
    INSERT INTO abandoned_carts (
      email, full_name, phone, vehicle_reg, vehicle_make, vehicle_model,
      vehicle_year, mileage, step_abandoned, created_at, updated_at
    ) VALUES (
      v_rec.email, v_rec.first_name, v_rec.phone, v_rec.vehicle_reg,
      v_rec.vehicle_make, v_rec.vehicle_model, v_rec.vehicle_year,
      v_rec.mileage, 2, now(), now()
    );
    v_created_carts := v_created_carts + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'updated_carts', v_updated_carts,
    'updated_leads', v_updated_leads,
    'created_new', v_created_carts,
    'lookback_hours', p_lookback_hours
  );
END;
$$;

-- 4) Create a standalone backfill function that can run anytime to fix gaps
CREATE OR REPLACE FUNCTION public.backfill_lead_data_from_step2()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
BEGIN
  -- Fix any sales_leads missing phone/name/reg by cross-referencing step2
  WITH step2_latest AS (
    SELECT DISTINCT ON (email)
      email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    ORDER BY email, created_at DESC
  ),
  fixed AS (
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
    FROM step2_latest s2
    WHERE sl.email = s2.email
    AND (
      sl.phone IS NULL OR btrim(sl.phone) = ''
      OR sl.first_name IS NULL OR btrim(sl.first_name) = ''
      OR sl.vehicle_reg IS NULL OR btrim(sl.vehicle_reg) = ''
    )
    RETURNING sl.id
  )
  SELECT count(*) INTO v_fixed_count FROM fixed;

  RETURN jsonb_build_object(
    'success', true,
    'leads_fixed', v_fixed_count
  );
END;
$$;
