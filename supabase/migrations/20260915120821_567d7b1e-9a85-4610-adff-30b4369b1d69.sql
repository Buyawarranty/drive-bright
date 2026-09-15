CREATE OR REPLACE FUNCTION public.search_import_leads(p_term text, p_limit integer DEFAULT 25)
 RETURNS TABLE(source text, row_id text, first_name text, last_name text, email text, phone text, vehicle_reg text, vehicle_make text, vehicle_model text, vehicle_year text, mileage text, plan_interest text, assigned_to uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_raw text := btrim(coalesce(p_term, ''));
  v_compact text;
  v_spaced text;
  v_digits text;
  v_tail9 text;
  v_frag text;
BEGIN
  IF NOT public.is_active_admin_user((SELECT auth.uid())) THEN
    RETURN;
  END IF;
  IF length(v_raw) < 2 THEN
    RETURN;
  END IF;

  v_compact := upper(regexp_replace(v_raw, '[^A-Za-z0-9]', '', 'g'));
  v_spaced := CASE WHEN length(v_compact) >= 5
                   THEN left(v_compact, length(v_compact) - 3) || ' ' || right(v_compact, 3)
                   ELSE v_compact END;
  v_digits := regexp_replace(v_raw, '\D', '', 'g');
  v_tail9 := CASE WHEN length(v_digits) >= 7 THEN right(v_digits, 9) ELSE NULL END;
  -- Partial phone numbers: agents often type only the first part of a mobile.
  -- Match on the digits-only form so "07703396" still finds "07703 396 123".
  v_frag := CASE WHEN length(v_digits) >= 5
                 THEN CASE WHEN left(v_digits, 2) = '44' AND length(v_digits) >= 11
                           THEN '0' || substring(v_digits from 3)
                           ELSE v_digits END
                 ELSE NULL END;

  RETURN QUERY
  SELECT 'lead'::text, sl.id::text, sl.first_name, sl.last_name, sl.email, sl.phone,
         sl.vehicle_reg, sl.vehicle_make, sl.vehicle_model, sl.vehicle_year,
         sl.mileage, sl.plan_interest, sl.assigned_to, sl.created_at
  FROM public.sales_leads sl
  WHERE sl.first_name ILIKE '%' || v_raw || '%'
     OR sl.last_name ILIKE '%' || v_raw || '%'
     OR sl.email ILIKE '%' || v_raw || '%'
     OR sl.vehicle_reg ILIKE '%' || v_compact || '%'
     OR sl.vehicle_reg ILIKE '%' || v_spaced || '%'
     OR (v_tail9 IS NOT NULL AND right(public.normalize_uk_phone(sl.phone), 9) = v_tail9)
     OR (v_frag IS NOT NULL AND public.normalize_uk_phone(sl.phone) LIKE '%' || v_frag || '%')
  ORDER BY sl.created_at DESC
  LIMIT p_limit;

  RETURN QUERY
  SELECT 'cart'::text, 'cart:' || ac.id::text,
         split_part(btrim(coalesce(ac.full_name, '')), ' ', 1),
         nullif(btrim(substr(btrim(coalesce(ac.full_name, '')), length(split_part(btrim(coalesce(ac.full_name, '')), ' ', 1)) + 1)), ''),
         ac.email, ac.phone, ac.vehicle_reg, ac.vehicle_make, ac.vehicle_model,
         ac.vehicle_year, ac.mileage, ac.plan_name, NULL::uuid, ac.updated_at
  FROM public.abandoned_carts ac
  WHERE ac.full_name ILIKE '%' || v_raw || '%'
     OR ac.email ILIKE '%' || v_raw || '%'
     OR ac.vehicle_reg ILIKE '%' || v_compact || '%'
     OR ac.vehicle_reg ILIKE '%' || v_spaced || '%'
     OR (v_tail9 IS NOT NULL AND right(regexp_replace(coalesce(ac.phone, ''), '\D', '', 'g'), 9) = v_tail9)
     OR (v_frag IS NOT NULL AND regexp_replace(coalesce(ac.phone, ''), '\D', '', 'g') LIKE '%' || v_frag || '%')
  ORDER BY ac.updated_at DESC
  LIMIT p_limit;

  RETURN QUERY
  SELECT 'customer'::text, 'customer:' || c.id::text,
         coalesce(c.first_name, split_part(btrim(coalesce(c.name, '')), ' ', 1)),
         coalesce(c.last_name, nullif(btrim(substr(btrim(coalesce(c.name, '')), length(split_part(btrim(coalesce(c.name, '')), ' ', 1)) + 1)), '')),
         c.email, c.phone, c.registration_plate, c.vehicle_make, c.vehicle_model,
         c.vehicle_year, c.mileage, c.plan_type, c.assigned_to, c.signup_date
  FROM public.customers c
  WHERE coalesce(c.is_deleted, false) = false
    AND (c.name ILIKE '%' || v_raw || '%'
      OR c.first_name ILIKE '%' || v_raw || '%'
      OR c.last_name ILIKE '%' || v_raw || '%'
      OR c.email ILIKE '%' || v_raw || '%'
      OR c.registration_plate ILIKE '%' || v_compact || '%'
      OR c.registration_plate ILIKE '%' || v_spaced || '%'
      OR (v_tail9 IS NOT NULL AND right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 9) = v_tail9)
      OR (v_frag IS NOT NULL AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '%' || v_frag || '%'))
  ORDER BY c.signup_date DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;