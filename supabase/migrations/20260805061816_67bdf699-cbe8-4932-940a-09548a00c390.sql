CREATE OR REPLACE FUNCTION public.postcode_district_stats(_from date, _to date, _area text)
RETURNS TABLE(district text, sales bigint, revenue numeric, claims bigint, claim_cost numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT
      (regexp_match(upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')), '^([A-Z]{1,2}[0-9][0-9A-Z]?)'))[1] AS district,
      count(*)::bigint AS sales,
      COALESCE(sum(COALESCE(c.final_amount, 0)), 0)::numeric AS revenue
    FROM public.customers c
    WHERE public.is_staff()
      AND COALESCE(c.signup_date, c.created_at) >= _from
      AND COALESCE(c.signup_date, c.created_at) < (_to + interval '1 day')
      AND (c.status IS NULL OR c.status NOT IN ('cancelled','refunded'))
      AND upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9]'
      AND (regexp_match(upper(regexp_replace(coalesce(c.postcode,''), '\s', '', 'g')), '^([A-Z]{1,2})'))[1] = upper(_area)
    GROUP BY 1
  ),
  cl AS (
    SELECT
      (regexp_match(upper(regexp_replace(x.postcode, '\s', '', 'g')), '^([A-Z]{1,2}[0-9][0-9A-Z]?)'))[1] AS district,
      count(*)::bigint AS claims,
      COALESCE(sum(x.cost), 0)::numeric AS claim_cost
    FROM (
      SELECT
        COALESCE(cs.paid_amount, cs.payment_amount, cs.claimed_amount, 0)::numeric AS cost,
        COALESCE((
          SELECT c.postcode
          FROM public.customers c
          WHERE (
                  cs.vehicle_registration IS NOT NULL
                  AND upper(regexp_replace(cs.vehicle_registration, '\s', '', 'g'))
                      = upper(regexp_replace(coalesce(c.registration_plate,''), '\s', '', 'g'))
                )
             OR (cs.email IS NOT NULL AND lower(cs.email) = lower(coalesce(c.email,'')))
          ORDER BY c.created_at DESC
          LIMIT 1
        ), '') AS postcode
      FROM public.claims_submissions cs
      WHERE public.is_staff()
        AND cs.created_at >= _from
        AND cs.created_at < (_to + interval '1 day')
    ) x
    WHERE upper(regexp_replace(x.postcode, '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9]'
      AND (regexp_match(upper(regexp_replace(x.postcode, '\s', '', 'g')), '^([A-Z]{1,2})'))[1] = upper(_area)
    GROUP BY 1
  )
  SELECT
    COALESCE(s.district, cl.district) AS district,
    COALESCE(s.sales, 0)::bigint,
    COALESCE(s.revenue, 0)::numeric,
    COALESCE(cl.claims, 0)::bigint,
    COALESCE(cl.claim_cost, 0)::numeric
  FROM s
  FULL OUTER JOIN cl ON cl.district = s.district
  ORDER BY 2 DESC, 1;
$$;

GRANT EXECUTE ON FUNCTION public.postcode_district_stats(date, date, text) TO authenticated;