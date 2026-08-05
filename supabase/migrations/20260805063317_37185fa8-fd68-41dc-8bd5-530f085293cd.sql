DROP FUNCTION IF EXISTS public.postcode_area_monthly_sales(date, date);
DROP FUNCTION IF EXISTS public.offline_campaign_monthly_stats(text[], date, date);

CREATE FUNCTION public.postcode_area_monthly_sales(_from date, _to date)
RETURNS TABLE(area text, month date, sales bigint, revenue numeric, organic_sales bigint, organic_revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (regexp_match(upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')), '^([A-Z]{1,2})'))[1] AS area,
    date_trunc('month', COALESCE(c.signup_date, c.created_at))::date AS month,
    count(*)::bigint AS sales,
    COALESCE(sum(COALESCE(c.final_amount, 0)), 0)::numeric AS revenue,
    count(*) FILTER (
      WHERE coalesce(c.gclid,'') = ''
        AND coalesce(c.acquisition_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
        AND coalesce(c.purchase_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
    )::bigint AS organic_sales,
    COALESCE(sum(COALESCE(c.final_amount, 0)) FILTER (
      WHERE coalesce(c.gclid,'') = ''
        AND coalesce(c.acquisition_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
        AND coalesce(c.purchase_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
    ), 0)::numeric AS organic_revenue
  FROM public.customers c
  WHERE public.is_staff()
    AND COALESCE(c.is_deleted, false) = false
    AND COALESCE(c.signup_date, c.created_at) >= _from
    AND COALESCE(c.signup_date, c.created_at) < (_to + interval '1 day')
    AND (c.status IS NULL OR c.status NOT IN ('cancelled','refunded'))
    AND coalesce(c.postcode,'') <> ''
    AND upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9]'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.postcode_area_monthly_sales(date, date) TO authenticated;

CREATE FUNCTION public.offline_campaign_monthly_stats(_prefixes text[], _from date, _to date)
RETURNS TABLE(month date, sales bigint, revenue numeric, organic_sales bigint, organic_revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', c.signup_date)::date AS month,
         count(*)::bigint AS sales,
         COALESCE(sum(c.final_amount), 0)::numeric AS revenue,
         count(*) FILTER (
           WHERE coalesce(c.gclid,'') = ''
             AND coalesce(c.acquisition_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
             AND coalesce(c.purchase_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
         )::bigint AS organic_sales,
         COALESCE(sum(c.final_amount) FILTER (
           WHERE coalesce(c.gclid,'') = ''
             AND coalesce(c.acquisition_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
             AND coalesce(c.purchase_source,'') NOT IN ('google_ads','facebook_ads','bing_ads')
         ), 0)::numeric AS organic_revenue
  FROM public.customers c
  WHERE public.is_staff()
    AND COALESCE(c.is_deleted, false) = false
    AND COALESCE(c.status, '') NOT ILIKE '%cancelled%'
    AND COALESCE(c.status, '') NOT ILIKE '%refunded%'
    AND c.signup_date >= _from
    AND c.signup_date < (_to + interval '1 day')
    AND c.postcode IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM unnest(_prefixes) p
      WHERE upper(regexp_replace(c.postcode, '\s', '', 'g')) LIKE upper(p) || '%'
    )
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.offline_campaign_monthly_stats(text[], date, date) TO authenticated;