CREATE OR REPLACE FUNCTION public.find_sales_lead_by_phone_tail9(tail_digits text)
RETURNS TABLE (id uuid, call_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.id, sl.call_count
  FROM public.sales_leads sl
  WHERE sl.phone IS NOT NULL
    AND btrim(sl.phone) <> ''
    AND RIGHT(public.normalize_uk_phone(sl.phone), 9) = tail_digits
  ORDER BY sl.updated_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_sales_lead_by_phone_tail9(text) TO service_role, authenticated;