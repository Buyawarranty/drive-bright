CREATE OR REPLACE FUNCTION public.postcode_area_monthly_sales(_from date, _to date)
RETURNS TABLE(area text, month date, sales bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (regexp_match(upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')), '^([A-Z]{1,2})'))[1] AS area,
    date_trunc('month', COALESCE(c.signup_date, c.created_at))::date AS month,
    count(*)::bigint AS sales,
    COALESCE(sum(COALESCE(c.final_amount, 0)), 0)::numeric AS revenue
  FROM public.customers c
  WHERE public.is_staff()
    AND COALESCE(c.signup_date, c.created_at) >= _from
    AND COALESCE(c.signup_date, c.created_at) < (_to + interval '1 day')
    AND (c.status IS NULL OR c.status NOT IN ('cancelled','refunded'))
    AND coalesce(c.postcode,'') <> ''
    AND upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9]'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.postcode_area_monthly_sales(date, date) TO authenticated;