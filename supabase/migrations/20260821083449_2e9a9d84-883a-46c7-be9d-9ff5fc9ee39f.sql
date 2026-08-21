CREATE OR REPLACE FUNCTION public.find_lead_owner_by_contact(_email text DEFAULT NULL, _phone9 text DEFAULT NULL)
RETURNS TABLE(id uuid, assigned_to uuid, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- UNION (not OR) so each branch can use its own index
  SELECT * FROM (
    SELECT sl.id, sl.assigned_to, sl.created_at
    FROM public.sales_leads sl
    WHERE _email IS NOT NULL AND btrim(_email) <> ''
      AND lower(btrim(sl.email)) = lower(btrim(_email))
    ORDER BY sl.created_at DESC
    LIMIT 10
  ) e
  UNION ALL
  SELECT * FROM (
    SELECT sl.id, sl.assigned_to, sl.created_at
    FROM public.sales_leads sl
    WHERE _phone9 IS NOT NULL AND length(_phone9) = 9
      AND sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
      AND RIGHT(public.normalize_uk_phone(sl.phone), 9) = _phone9
    ORDER BY sl.created_at DESC
    LIMIT 10
  ) p
  ORDER BY created_at DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.find_lead_owner_by_contact(text, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.find_lead_owner_by_contact(text, text) FROM anon;