CREATE OR REPLACE FUNCTION public.postcode_area_monthly_claims(_from date, _to date)
RETURNS TABLE(area text, month date, claims bigint, claim_cost numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cl AS (
    SELECT
      cs.id,
      date_trunc('month', cs.created_at)::date AS month,
      COALESCE(cs.paid_amount, cs.payment_amount, cs.claimed_amount, 0)::numeric AS cost,
      (
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
      ) AS postcode
    FROM public.claims_submissions cs
    WHERE public.is_staff()
      AND cs.created_at >= _from
      AND cs.created_at < (_to + interval '1 day')
  )
  SELECT
    (regexp_match(upper(regexp_replace(coalesce(cl.postcode,''), '\s', '', 'g')), '^([A-Z]{1,2})'))[1] AS area,
    cl.month,
    count(*)::bigint AS claims,
    COALESCE(sum(cl.cost), 0)::numeric AS claim_cost
  FROM cl
  WHERE coalesce(cl.postcode,'') <> ''
    AND upper(regexp_replace(cl.postcode, '\s', '', 'g')) ~ '^[A-Z]{1,2}[0-9]'
  GROUP BY 1, 2
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.postcode_area_monthly_claims(date, date) TO authenticated;