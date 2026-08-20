CREATE OR REPLACE FUNCTION public.evaluate_agent_lead_freeze()
RETURNS TABLE(admin_user_id uuid, outcome text, reason text, freeze_days integer, frozen_until date, sales_in_window integer, revenue_mtd numeric, pro_rata_target numeric, monthly_target numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  a record;
  v_days date[];
  v_last2 integer;
  v_last3 integer;
  v_today_sales integer;
  v_target numeric;
  v_rev numeric;
  v_pro numeric;
  v_elapsed numeric;
  v_total numeric;
  v_kind integer;
  v_reason text;
  v_until date;
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
  v_month_start date := date_trunc('month', (now() AT TIME ZONE 'Europe/London'))::date;
BEGIN
  FOR a IN
    SELECT c.admin_user_id AS id, c.auto_freeze_enabled, c.paused, c.freeze_source, c.frozen_until
    FROM public.agent_distribution_caps c
    JOIN public.admin_users u ON u.id = c.admin_user_id
    WHERE u.is_active = true
      AND u.archived_at IS NULL
      AND u.role IN ('sales', 'sales_lead')
  LOOP
    SELECT array_agg(d ORDER BY d)
      INTO v_days
    FROM (
      SELECT w.work_date AS d
      FROM public.agent_working_days w
      WHERE w.admin_user_id = a.id
        AND w.day_type IN ('full_day', 'half_day')
        AND w.work_date < v_today
      ORDER BY w.work_date DESC
      LIMIT 3
    ) t;

    SELECT
      COALESCE(SUM(CASE WHEN cu.signup_date::date = ANY (v_days[array_length(v_days,1)-1 : array_length(v_days,1)]) THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cu.signup_date::date = ANY (v_days) THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cu.signup_date::date = v_today THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cu.signup_date::date >= v_month_start THEN COALESCE(cu.final_amount, 0) ELSE 0 END), 0)
      INTO v_last2, v_last3, v_today_sales, v_rev
    FROM public.customers cu
    WHERE cu.is_deleted = false
      AND lower(COALESCE(cu.status, '')) = 'active'
      AND cu.signup_date >= (v_month_start - interval '40 days')
      AND COALESCE(cu.sale_credit_admin_user_id, cu.payment_confirmed_by, cu.quote_sent_by, cu.assigned_to) = a.id;

    SELECT COALESCE(MAX(NULLIF(st.revenue_target, 0)), MAX(NULLIF(st.target_amount, 0)))
      INTO v_target
    FROM public.sales_targets st
    WHERE st.admin_user_id = a.id
      AND st.target_period = 'monthly'
      AND st.start_date >= v_month_start
      AND st.start_date < (v_month_start + interval '1 month');

    SELECT
      COALESCE(SUM(CASE WHEN w.work_date <= v_today THEN CASE WHEN w.day_type = 'half_day' THEN 0.5 ELSE 1 END ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN w.day_type = 'half_day' THEN 0.5 ELSE 1 END), 0)
      INTO v_elapsed, v_total
    FROM public.agent_working_days w
    WHERE w.admin_user_id = a.id
      AND w.day_type IN ('full_day', 'half_day')
      AND w.work_date >= v_month_start
      AND w.work_date < (v_month_start + interval '1 month');

    v_pro := CASE WHEN v_target IS NULL OR v_total <= 0 THEN NULL
                  ELSE ROUND(v_target * (v_elapsed / v_total), 2) END;

    v_kind := 0;
    v_reason := 'Sales pattern is within policy — leads keep flowing.';
    IF v_days IS NOT NULL AND array_length(v_days, 1) = 3 AND v_last3 <= 1 THEN
      v_kind := 2;
      v_reason := 'One sale or fewer across the last three working days.';
    ELSIF v_days IS NOT NULL AND array_length(v_days, 1) >= 2 AND v_last2 <= 1 THEN
      v_kind := 1;
      v_reason := 'One sale or fewer across the last two working days.';
    END IF;

    -- A sale today always clears an automatic freeze
    IF v_kind > 0 AND v_today_sales > 0 THEN
      v_kind := 0;
      v_reason := 'Sale made today — leads back on.';
    END IF;

    IF v_kind > 0 AND v_pro IS NOT NULL AND v_rev >= v_pro THEN
      v_kind := 0;
      v_reason := 'On target pro-rata (' || ROUND(v_rev)::text || ' of ' || ROUND(v_pro)::text || ' due so far) — exempt from freeze.';
    END IF;

    IF a.freeze_source = 'manager_override' AND a.frozen_until IS NOT NULL AND a.frozen_until >= v_today THEN
      RETURN QUERY SELECT a.id, 'manager_override'::text, 'Manager switched leads back on.'::text,
                          0, a.frozen_until, v_last2, v_rev, v_pro, v_target;
      CONTINUE;
    END IF;

    IF v_kind > 0 THEN
      v_until := v_today + v_kind;
      IF a.freeze_source IS DISTINCT FROM 'auto' OR a.paused IS NOT TRUE OR a.frozen_until IS DISTINCT FROM v_until THEN
        UPDATE public.agent_distribution_caps
        SET paused = true,
            freeze_source = 'auto',
            freeze_reason = v_reason,
            frozen_until = v_until,
            frozen_at = now(),
            updated_at = now()
        WHERE agent_distribution_caps.admin_user_id = a.id
          AND agent_distribution_caps.auto_freeze_enabled = true;

        IF FOUND THEN
          INSERT INTO public.lead_freeze_log (admin_user_id, action, reason, freeze_days, frozen_until,
                                              sales_in_window, window_days, revenue_mtd, pro_rata_target, monthly_target)
          VALUES (a.id, 'frozen', v_reason, v_kind, v_until,
                  CASE WHEN v_kind = 2 THEN v_last3 ELSE v_last2 END, v_days, v_rev, v_pro, v_target);
        END IF;
      END IF;
      RETURN QUERY SELECT a.id, ('freeze_' || v_kind::text)::text, v_reason, v_kind, v_until,
                          CASE WHEN v_kind = 2 THEN v_last3 ELSE v_last2 END, v_rev, v_pro, v_target;
    ELSE
      -- lift an automatic freeze: expired, or cleared by today's sale
      IF a.freeze_source = 'auto' AND (a.frozen_until IS NULL OR a.frozen_until <= v_today OR v_today_sales > 0) THEN
        UPDATE public.agent_distribution_caps
        SET paused = false,
            freeze_source = NULL,
            freeze_reason = NULL,
            frozen_until = NULL,
            frozen_at = NULL,
            updated_at = now()
        WHERE agent_distribution_caps.admin_user_id = a.id;

        INSERT INTO public.lead_freeze_log (admin_user_id, action, reason, freeze_days, frozen_until,
                                            sales_in_window, window_days, revenue_mtd, pro_rata_target, monthly_target)
        VALUES (a.id, 'unfrozen', v_reason, 0, NULL, v_last2, v_days, v_rev, v_pro, v_target);
      END IF;
      RETURN QUERY SELECT a.id, 'none'::text, v_reason, 0, NULL::date, v_last2, v_rev, v_pro, v_target;
    END IF;
  END LOOP;
END;
$fn$;