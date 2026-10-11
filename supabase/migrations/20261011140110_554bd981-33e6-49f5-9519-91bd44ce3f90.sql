CREATE OR REPLACE FUNCTION public.get_direct_sales_analysis(_from date DEFAULT '2026-03-01')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = true
      AND role::text IN ('admin','super_admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  WITH months AS (
    SELECT generate_series(date_trunc('month', _from::timestamp), date_trunc('month', now()), interval '1 month') AS m
  ),
  direct AS (
    SELECT date_trunc('month', signup_date) m, count(*) n, sum(final_amount) rev
    FROM customers
    WHERE signup_date >= _from
      AND coalesce(status,'') NOT IN ('cancelled','refunded')
      AND coalesce(is_deleted,false) = false
      AND is_manual_entry IS NOT TRUE
      AND payment_confirmed_by IS NULL
      AND coalesce(final_amount,0) > 10
    GROUP BY 1
  ),
  s4 AS (
    SELECT date_trunc('month', created_at) m, count(*) n,
      avg(total_price) FILTER (WHERE payment_type='12months' AND total_price > 10) p12,
      avg(total_price) FILTER (WHERE payment_type='24months' AND total_price > 10) p24,
      avg(total_price) FILTER (WHERE payment_type='36months' AND total_price > 10) p36
    FROM abandoned_carts
    WHERE step_abandoned = 4 AND created_at >= _from
    GROUP BY 1
  ),
  bump AS (
    SELECT date_trunc('month', created_at) m, count(*) started,
      count(*) FILTER (WHERE status='completed') completed
    FROM bumper_transactions WHERE created_at >= _from GROUP BY 1
  ),
  sf AS (
    SELECT date_trunc('month', created_at) m, count(*) n
    FROM stripe_payment_failures WHERE created_at >= _from GROUP BY 1
  ),
  st AS (
    SELECT date_trunc('month', created_at) m,
      count(*) FILTER (WHERE signal_type='long_dwell') long_dwell,
      count(*) FILTER (WHERE signal_type='idle_timeout') idle_timeout,
      count(*) FILTER (WHERE signal_type='multi_attempt') multi_attempt,
      count(*) FILTER (WHERE signal_type='method_thrash') method_thrash,
      count(*) FILTER (WHERE signal_type='payment_failed') payment_failed
    FROM checkout_struggle_alerts WHERE created_at >= _from GROUP BY 1
  ),
  monthly AS (
    SELECT jsonb_agg(jsonb_build_object(
      'month', to_char(months.m,'YYYY-MM'),
      'direct_sales', coalesce(direct.n,0),
      'direct_revenue', round(coalesce(direct.rev,0)),
      'step4_reached', coalesce(s4.n,0),
      'avg_price_12', round(s4.p12), 'avg_price_24', round(s4.p24), 'avg_price_36', round(s4.p36),
      'bumper_started', coalesce(bump.started,0), 'bumper_completed', coalesce(bump.completed,0),
      'card_failures', coalesce(sf.n,0) + coalesce(st.payment_failed,0),
      'long_dwell', coalesce(st.long_dwell,0), 'idle_timeout', coalesce(st.idle_timeout,0),
      'multi_attempt', coalesce(st.multi_attempt,0), 'method_thrash', coalesce(st.method_thrash,0)
    ) ORDER BY months.m) j
    FROM months
    LEFT JOIN direct ON direct.m = months.m
    LEFT JOIN s4 ON s4.m = months.m
    LEFT JOIN bump ON bump.m = months.m
    LEFT JOIN sf ON sf.m = months.m
    LEFT JOIN st ON st.m = months.m
  ),
  top_combos AS (
    SELECT payment_type, labour_rate, claim_limit, voluntary_excess
    FROM abandoned_carts
    WHERE step_abandoned = 4 AND created_at >= _from AND total_price > 10
      AND payment_type IS NOT NULL AND labour_rate IS NOT NULL AND claim_limit IS NOT NULL
    GROUP BY 1,2,3,4 ORDER BY count(*) DESC LIMIT 6
  ),
  combos AS (
    SELECT jsonb_agg(jsonb_build_object(
      'month', to_char(x.m,'YYYY-MM'),
      'combo', x.payment_type || ' · £' || x.labour_rate || '/hr · £' || x.claim_limit || ' limit · £' || coalesce(x.voluntary_excess::text,'?') || ' excess',
      'avg_price', round(x.p), 'n', x.n
    ) ORDER BY x.m) j
    FROM (
      SELECT date_trunc('month', c.created_at) m, c.payment_type, c.labour_rate, c.claim_limit, c.voluntary_excess,
        avg(c.total_price) p, count(*) n
      FROM abandoned_carts c
      JOIN top_combos t ON t.payment_type = c.payment_type AND t.labour_rate = c.labour_rate
        AND t.claim_limit = c.claim_limit AND t.voluntary_excess IS NOT DISTINCT FROM c.voluntary_excess
      WHERE c.step_abandoned = 4 AND c.created_at >= _from AND c.total_price > 10
      GROUP BY 1,2,3,4,5
    ) x
  )
  SELECT jsonb_build_object('monthly', coalesce((SELECT j FROM monthly),'[]'::jsonb),
                            'combos', coalesce((SELECT j FROM combos),'[]'::jsonb))
  INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_direct_sales_analysis(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_direct_sales_analysis(date) TO authenticated;