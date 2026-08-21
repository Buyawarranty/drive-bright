-- Index the tail-9 phone form so contact lookups stop scanning every lead
CREATE INDEX IF NOT EXISTS idx_sales_leads_phone_tail9
  ON public.sales_leads (RIGHT(public.normalize_uk_phone(phone), 9))
  WHERE phone IS NOT NULL AND btrim(phone) <> '';

-- Single indexed lookup for "whose lead is this?" (email or phone tail-9)
CREATE OR REPLACE FUNCTION public.find_lead_owner_by_contact(_email text DEFAULT NULL, _phone9 text DEFAULT NULL)
RETURNS TABLE(id uuid, assigned_to uuid, created_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sl.id, sl.assigned_to, sl.created_at
  FROM public.sales_leads sl
  WHERE (
      (_email IS NOT NULL AND _email <> '' AND lower(btrim(sl.email)) = lower(btrim(_email)))
      OR (_phone9 IS NOT NULL AND length(_phone9) = 9
          AND sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
          AND RIGHT(public.normalize_uk_phone(sl.phone), 9) = _phone9)
    )
  ORDER BY sl.created_at DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.find_lead_owner_by_contact(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_lead_owner_by_contact(text, text) TO authenticated;

-- Same index benefit for the existing tail-9 helper
CREATE OR REPLACE FUNCTION public.find_sales_lead_by_phone_tail9(tail_digits text)
RETURNS TABLE(id uuid, call_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sl.id, sl.call_count
  FROM public.sales_leads sl
  WHERE sl.phone IS NOT NULL
    AND btrim(sl.phone) <> ''
    AND RIGHT(public.normalize_uk_phone(sl.phone), 9) = tail_digits
  ORDER BY sl.updated_at DESC
  LIMIT 1;
$$;