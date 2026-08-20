-- 1. Freeze state on the allocation switch
ALTER TABLE public.agent_distribution_caps
  ADD COLUMN IF NOT EXISTS auto_freeze_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS freeze_source text,
  ADD COLUMN IF NOT EXISTS freeze_reason text,
  ADD COLUMN IF NOT EXISTS frozen_until date,
  ADD COLUMN IF NOT EXISTS frozen_at timestamptz;

-- 2. Audit / notification log
CREATE TABLE IF NOT EXISTS public.lead_freeze_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL,
  action text NOT NULL,
  reason text,
  freeze_days integer,
  frozen_until date,
  sales_in_window integer,
  window_days date[],
  revenue_mtd numeric,
  pro_rata_target numeric,
  monthly_target numeric,
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lead_freeze_log TO authenticated;
GRANT ALL ON public.lead_freeze_log TO service_role;

ALTER TABLE public.lead_freeze_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read lead freeze log"
  ON public.lead_freeze_log FOR SELECT TO authenticated
  USING (public.is_active_admin_user(auth.uid()));

CREATE POLICY "Service role manages lead freeze log"
  ON public.lead_freeze_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_lead_freeze_log_agent_created
  ON public.lead_freeze_log (admin_user_id, created_at DESC);

-- 3. Evaluation + application of the freeze policy
CREATE OR REPLACE FUNCTION public.evaluate_agent_lead_freeze()
RETURNS TABLE (
  admin_user_id uuid,
  outcome text,
  reason text,
  freeze_days integer,
  frozen_until date,
  sales_in_window integer,
  revenue_mtd numeric,
  pro_rata_target numeric,
  monthly_target numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a record;
  v_days date[];
  v_last2 integer;
  v_last3 integer;
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
    -- last three completed service days (rota)
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

    -- sales credited to this agent, per day
    SELECT
      COALESCE(SUM(CASE WHEN cu.signup_date::date = ANY (v_days[array_length(v_days,1)-1 : array_length(v_days,1)]) THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cu.signup_date::date = ANY (v_days) THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN cu.signup_date::date >= v_month_start THEN COALESCE(cu.final_amount, 0) ELSE 0 END), 0)
      INTO v_last2, v_last3, v_rev
    FROM public.customers cu
    WHERE cu.is_deleted = false
      AND lower(COALESCE(cu.status, '')) = 'active'
      AND cu.signup_date >= (v_month_start - interval '40 days')
      AND COALESCE(cu.sale_credit_admin_user_id, cu.payment_confirmed_by, cu.quote_sent_by, cu.assigned_to) = a.id;

    -- monthly target
    SELECT COALESCE(MAX(NULLIF(st.revenue_target, 0)), MAX(NULLIF(st.target_amount, 0)))
      INTO v_target
    FROM public.sales_targets st
    WHERE st.admin_user_id = a.id
      AND st.target_period = 'monthly'
      AND st.start_date >= v_month_start
      AND st.start_date < (v_month_start + interval '1 month');

    -- pro-rata target based on rota days elapsed vs planned this month
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

    -- decide
    v_kind := 0;
    v_reason := 'Sales pattern is within policy — leads keep flowing.';
    IF v_days IS NOT NULL AND array_length(v_days, 1) = 3 AND v_last3 <= 1 THEN
      v_kind := 2;
      v_reason := 'One sale or fewer across the last three working days.';
    ELSIF v_days IS NOT NULL AND array_length(v_days, 1) >= 2 AND v_last2 <= 1 THEN
      v_kind := 1;
      v_reason := 'One sale or fewer across the last two working days.';
    END IF;

    -- pro-rata on-target agents are exempt
    IF v_kind > 0 AND v_pro IS NOT NULL AND v_rev >= v_pro THEN
      v_kind := 0;
      v_reason := 'On target pro-rata (' || ROUND(v_rev)::text || ' of ' || ROUND(v_pro)::text || ' due so far) — exempt from freeze.';
    END IF;

    -- manager override for today wins
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
      -- lift an expired automatic freeze
      IF a.freeze_source = 'auto' AND (a.frozen_until IS NULL OR a.frozen_until <= v_today) THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_agent_lead_freeze() TO authenticated, service_role;

-- 4. Manager switch: turn an agent's leads on or off explicitly
CREATE OR REPLACE FUNCTION public.set_agent_lead_allocation(_admin_user_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/London')::date;
BEGIN
  IF NOT public.can_manage_lead_routing() THEN
    RAISE EXCEPTION 'Not permitted to change lead allocation';
  END IF;

  IF _enabled THEN
    UPDATE public.agent_distribution_caps
    SET paused = false,
        freeze_source = 'manager_override',
        freeze_reason = 'Manager switched leads back on',
        frozen_until = v_today,
        frozen_at = now(),
        updated_at = now()
    WHERE admin_user_id = _admin_user_id;

    INSERT INTO public.lead_freeze_log (admin_user_id, action, reason, freeze_days, frozen_until)
    VALUES (_admin_user_id, 'manager_on', 'Manager switched leads back on', 0, v_today);
  ELSE
    UPDATE public.agent_distribution_caps
    SET paused = true,
        freeze_source = 'manager',
        freeze_reason = 'Manager switched leads off',
        frozen_until = NULL,
        frozen_at = now(),
        updated_at = now()
    WHERE admin_user_id = _admin_user_id;

    INSERT INTO public.lead_freeze_log (admin_user_id, action, reason, freeze_days, frozen_until)
    VALUES (_admin_user_id, 'manager_off', 'Manager switched leads off', 0, NULL);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_agent_lead_allocation(uuid, boolean) TO authenticated, service_role;

-- 5. Toggle the automatic rule per agent
CREATE OR REPLACE FUNCTION public.set_agent_auto_freeze(_admin_user_id uuid, _enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_manage_lead_routing() THEN
    RAISE EXCEPTION 'Not permitted to change lead allocation';
  END IF;

  UPDATE public.agent_distribution_caps
  SET auto_freeze_enabled = _enabled, updated_at = now()
  WHERE admin_user_id = _admin_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_agent_auto_freeze(uuid, boolean) TO authenticated, service_role;