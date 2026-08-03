ALTER TABLE public.sales_targets
  ADD COLUMN IF NOT EXISTS working_days integer,
  ADD COLUMN IF NOT EXISTS full_month_days integer;

DROP FUNCTION IF EXISTS public.get_team_scoreboard(timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION public.get_team_scoreboard(p_start timestamptz, p_end timestamptz)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  team_sort integer,
  admin_user_id uuid,
  agent_name text,
  revenue numeric,
  sales_count integer,
  pct_achieved integer,
  revenue_target numeric,
  full_month_target numeric,
  working_days integer,
  full_month_days integer,
  team_revenue numeric,
  team_pct integer,
  is_self boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid;
  v_is_mgmt boolean;
  v_default_days integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  SELECT au.id INTO v_me FROM public.admin_users au WHERE au.user_id = auth.uid() LIMIT 1;
  v_is_mgmt := public.is_management(auth.uid());

  -- Default full-month working days = weekdays (Mon-Fri) in the requested month
  SELECT COUNT(*)::int INTO v_default_days
  FROM generate_series(date_trunc('month', p_start)::date,
                       (date_trunc('month', p_start) + interval '1 month - 1 day')::date,
                       interval '1 day') d
  WHERE EXTRACT(ISODOW FROM d) < 6;

  RETURN QUERY
  WITH members AS (
    SELECT ltm.team_id AS tid, lt.name AS tname, lt.sort_order AS tsort, ltm.admin_user_id AS aid,
           TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, '')) AS aname,
           au.email AS aemail
    FROM public.lead_team_members ltm
    JOIN public.lead_teams lt ON lt.id = ltm.team_id AND lt.is_active
    JOIN public.admin_users au ON au.id = ltm.admin_user_id AND au.is_active
    WHERE v_is_mgmt
       OR ltm.team_id IN (SELECT team_id FROM public.lead_team_members WHERE admin_user_id = v_me)
  ),
  sales AS (
    SELECT COALESCE(c.sale_credit_admin_user_id, c.payment_confirmed_by, c.quote_sent_by, c.assigned_to) AS aid,
           SUM(COALESCE(c.final_amount, 0))::numeric AS revenue,
           COUNT(*)::int AS sales_count
    FROM public.customers c
    WHERE c.is_deleted = false
      AND LOWER(COALESCE(c.status, '')) = 'active'
      AND c.signup_date >= p_start
      AND c.signup_date <= p_end
    GROUP BY 1
  ),
  targets AS (
    SELECT m.aid,
           COALESCE(t.revenue_target, 35000)::numeric AS full_target,
           COALESCE(t.full_month_days, v_default_days) AS f_days,
           COALESCE(t.working_days, t.full_month_days, v_default_days) AS w_days
    FROM members m
    LEFT JOIN LATERAL (
      SELECT st.revenue_target, st.working_days, st.full_month_days
      FROM public.sales_targets st
      WHERE st.admin_user_id = m.aid
        AND st.target_period = 'monthly'
        AND st.start_date <= p_end AND st.end_date >= p_start
        AND st.revenue_target IS NOT NULL
      ORDER BY st.start_date DESC LIMIT 1
    ) t ON true
  ),
  rows_ AS (
    SELECT m.tid, m.tname, m.tsort, m.aid,
           NULLIF(m.aname, '') AS aname_final,
           m.aemail,
           COALESCE(s.revenue, 0)::numeric AS revenue,
           COALESCE(s.sales_count, 0)::int AS sales_count,
           t.full_target,
           GREATEST(t.f_days, 1) AS f_days,
           GREATEST(LEAST(t.w_days, GREATEST(t.f_days, 1)), 0) AS w_days,
           ROUND(t.full_target * GREATEST(LEAST(t.w_days, GREATEST(t.f_days, 1)), 0)::numeric
                 / GREATEST(t.f_days, 1)::numeric) AS target
    FROM members m
    LEFT JOIN sales s ON s.aid = m.aid
    JOIN targets t ON t.aid = m.aid
  ),
  team_totals AS (
    SELECT tid, SUM(revenue) AS t_revenue, SUM(target) AS t_target
    FROM rows_ GROUP BY tid
  )
  SELECT r.tid,
         r.tname,
         r.tsort,
         r.aid,
         COALESCE(r.aname_final, r.aemail) AS agent_name,
         r.revenue,
         r.sales_count,
         CASE WHEN r.target > 0 THEN ROUND(r.revenue / r.target * 100)::int ELSE NULL END,
         CASE WHEN v_is_mgmt OR r.aid = v_me THEN r.target ELSE NULL END,
         CASE WHEN v_is_mgmt OR r.aid = v_me THEN r.full_target ELSE NULL END,
         r.w_days::int,
         r.f_days::int,
         tt.t_revenue,
         CASE WHEN tt.t_target > 0 THEN ROUND(tt.t_revenue / tt.t_target * 100)::int ELSE NULL END,
         (r.aid = v_me)
  FROM rows_ r
  JOIN team_totals tt ON tt.tid = r.tid
  ORDER BY r.tsort, r.revenue DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_scoreboard(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_team_scoreboard(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_scoreboard(timestamptz, timestamptz) TO service_role;