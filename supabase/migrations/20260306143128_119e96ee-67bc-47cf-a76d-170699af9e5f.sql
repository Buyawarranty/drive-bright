WITH lead_recovery AS (
  SELECT sl.id,
         COALESCE(
           NULLIF(btrim(sl.phone), ''),
           (SELECT NULLIF(btrim(ac.phone), '') FROM public.abandoned_carts ac WHERE lower(ac.email)=lower(sl.email) AND ac.phone IS NOT NULL AND btrim(ac.phone)<>'' ORDER BY ac.created_at DESC LIMIT 1),
           (SELECT NULLIF(btrim(sl2.phone), '') FROM public.sales_leads sl2 WHERE lower(sl2.email)=lower(sl.email) AND sl2.id<>sl.id AND sl2.phone IS NOT NULL AND btrim(sl2.phone)<>'' ORDER BY sl2.created_at DESC LIMIT 1),
           (SELECT NULLIF(btrim(ma.phone), '') FROM public.marketing_audience ma WHERE lower(ma.email)=lower(sl.email) AND ma.phone IS NOT NULL AND btrim(ma.phone)<>'' ORDER BY ma.synced_at DESC NULLS LAST LIMIT 1),
           (SELECT NULLIF(btrim(c.phone), '') FROM public.customers c WHERE lower(c.email)=lower(sl.email) AND c.phone IS NOT NULL AND btrim(c.phone)<>'' ORDER BY c.created_at DESC LIMIT 1),
           (SELECT NULLIF(btrim(cs.phone), '') FROM public.contact_submissions cs WHERE lower(cs.email)=lower(sl.email) AND cs.phone IS NOT NULL AND btrim(cs.phone)<>'' ORDER BY cs.created_at DESC LIMIT 1)
         ) AS phone_to_set,
         COALESCE(
           NULLIF(btrim(sl.first_name), ''),
           (SELECT NULLIF(split_part(btrim(ac.full_name), ' ', 1), '') FROM public.abandoned_carts ac WHERE lower(ac.email)=lower(sl.email) AND ac.full_name IS NOT NULL AND btrim(ac.full_name)<>'' ORDER BY ac.created_at DESC LIMIT 1),
           (SELECT NULLIF(btrim(sl2.first_name), '') FROM public.sales_leads sl2 WHERE lower(sl2.email)=lower(sl.email) AND sl2.id<>sl.id AND sl2.first_name IS NOT NULL AND btrim(sl2.first_name)<>'' ORDER BY sl2.created_at DESC LIMIT 1),
           (SELECT NULLIF(split_part(btrim(ma.full_name), ' ', 1), '') FROM public.marketing_audience ma WHERE lower(ma.email)=lower(sl.email) AND ma.full_name IS NOT NULL AND btrim(ma.full_name)<>'' ORDER BY ma.synced_at DESC NULLS LAST LIMIT 1),
           (SELECT NULLIF(btrim(c.first_name), '') FROM public.customers c WHERE lower(c.email)=lower(sl.email) AND c.first_name IS NOT NULL AND btrim(c.first_name)<>'' ORDER BY c.created_at DESC LIMIT 1),
           (SELECT NULLIF(split_part(btrim(cs.name), ' ', 1), '') FROM public.contact_submissions cs WHERE lower(cs.email)=lower(sl.email) AND cs.name IS NOT NULL AND btrim(cs.name)<>'' ORDER BY cs.created_at DESC LIMIT 1)
         ) AS first_name_to_set
  FROM public.sales_leads sl
  WHERE sl.status='new'
    AND (sl.phone IS NULL OR btrim(sl.phone) = '' OR sl.first_name IS NULL OR btrim(sl.first_name) = '')
)
UPDATE public.sales_leads sl
SET phone = CASE WHEN (sl.phone IS NULL OR btrim(sl.phone) = '') AND lr.phone_to_set IS NOT NULL THEN lr.phone_to_set ELSE sl.phone END,
    first_name = CASE WHEN (sl.first_name IS NULL OR btrim(sl.first_name) = '') AND lr.first_name_to_set IS NOT NULL THEN lr.first_name_to_set ELSE sl.first_name END,
    updated_at = now()
FROM lead_recovery lr
WHERE sl.id = lr.id
  AND (
    ((sl.phone IS NULL OR btrim(sl.phone) = '') AND lr.phone_to_set IS NOT NULL)
    OR ((sl.first_name IS NULL OR btrim(sl.first_name) = '') AND lr.first_name_to_set IS NOT NULL)
  );