
-- Fix the two leads with email-as-name
UPDATE sales_leads SET first_name = 'Nikesh' WHERE email = 'nikson143@hotmail.com' AND first_name = 'nikson143@hotmail.com' AND created_at >= '2026-04-13T00:00:00Z';
UPDATE sales_leads SET first_name = 'Donald' WHERE email = 'donmur2015@gmail.com' AND first_name = 'donmur2015@gmail.com' AND created_at >= '2026-04-13T00:00:00Z';
UPDATE abandoned_carts SET full_name = 'Nikesh' WHERE email = 'nikson143@hotmail.com' AND full_name = 'nikson143@hotmail.com';
UPDATE abandoned_carts SET full_name = 'Donald' WHERE email = 'donmur2015@gmail.com' AND full_name = 'donmur2015@gmail.com';

-- Update backfill function to also fix email-as-name issues
CREATE OR REPLACE FUNCTION public.backfill_lead_data_from_step2()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed_count INTEGER := 0;
BEGIN
  WITH step2_latest AS (
    SELECT DISTINCT ON (email)
      email, first_name, phone, vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage
    FROM step2_submission_attempts
    ORDER BY email, created_at DESC
  ),
  fixed AS (
    UPDATE sales_leads sl
    SET 
      first_name = CASE 
        WHEN sl.first_name IS NULL OR btrim(sl.first_name) = '' OR position('@' in COALESCE(sl.first_name,'')) > 0
        THEN COALESCE(s2.first_name, sl.first_name)
        ELSE sl.first_name
      END,
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
      OR sl.first_name IS NULL OR btrim(sl.first_name) = '' OR position('@' in COALESCE(sl.first_name,'')) > 0
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
