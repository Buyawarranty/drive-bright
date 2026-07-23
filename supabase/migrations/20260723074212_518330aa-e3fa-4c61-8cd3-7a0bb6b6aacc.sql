
-- ============================================================
-- Offered ORR (120s Accept/Pass) - infrastructure
-- ============================================================

-- 1) Columns for offer state
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS orr_offer_passed_by uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS orr_offer_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_orr_offer_expires
  ON public.sales_leads (orr_offer_expires_at)
  WHERE pool_status = 'offered';

-- 2) Offer a lead to the next eligible ORR agent.
--    Returns the agent uuid it was offered to, or NULL if no eligible agent.
CREATE OR REPLACE FUNCTION public.orr_offer_lead_to_next(_lead uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_agent uuid;
  v_now timestamptz := now();
  v_london timestamptz := (v_now AT TIME ZONE 'Europe/London');
  v_hour int := extract(hour from v_london)::int;
BEGIN
  SELECT id, assigned_to, pool_status, orr_offer_passed_by, eligible_at,
         orr_pool_next_open_at, status, is_paid
    INTO v_lead
    FROM public.sales_leads
   WHERE id = _lead
   FOR UPDATE;

  IF v_lead.id IS NULL THEN RETURN NULL; END IF;
  IF COALESCE(v_lead.is_paid,false) THEN RETURN NULL; END IF;

  -- Gate: overnight - defer, do not offer yet.
  IF (v_lead.eligible_at IS NOT NULL AND v_lead.eligible_at > v_now)
     OR (v_lead.orr_pool_next_open_at IS NOT NULL AND v_lead.orr_pool_next_open_at > v_now)
     OR v_hour < 9 OR v_hour >= 18 THEN
    RETURN NULL;
  END IF;

  -- Pick next ORR agent not already in passed list, respecting caps, duty, mode.
  SELECT adc.admin_user_id INTO v_agent
    FROM public.agent_distribution_caps adc
    JOIN public.admin_users au ON au.id = adc.admin_user_id
   WHERE au.is_active = true
     AND au.role IN ('sales','sales_lead')
     AND COALESCE(adc.paused,false) = false
     AND COALESCE(adc.assignment_mode,'round_robin') = 'open_pool'
     AND public.is_agent_on_duty(adc.admin_user_id)
     AND (adc.daily_cap IS NULL OR adc.assigned_today < adc.daily_cap)
     AND NOT (adc.admin_user_id = ANY(COALESCE(v_lead.orr_offer_passed_by,'{}'::uuid[])))
   ORDER BY
     COALESCE(adc.assigned_today,0) ASC,
     adc.last_assigned_at ASC NULLS FIRST,
     adc.sort_order ASC
   LIMIT 1;

  IF v_agent IS NULL THEN
    -- No agent left: drop into shared claim pool.
    UPDATE public.sales_leads
       SET assigned_to = NULL,
           owner_agent = NULL,
           pool_status = 'new',
           queue = 'live_open_pool',
           orr_first_call_deadline = NULL,
           orr_offer_expires_at = NULL,
           orr_offer_passed_by = '{}'::uuid[],
           updated_at = v_now
     WHERE id = _lead;
    RETURN NULL;
  END IF;

  UPDATE public.sales_leads
     SET assigned_to = v_agent,
         owner_agent = v_agent,
         assigned_at = v_now,
         pool_status = 'offered',
         queue = 'live_open_pool',
         orr_first_call_deadline = v_now + interval '120 seconds',
         orr_offer_expires_at    = v_now + interval '120 seconds',
         updated_at = v_now
   WHERE id = _lead;

  UPDATE public.agent_distribution_caps
     SET last_assigned_at = v_now
   WHERE admin_user_id = v_agent;

  RETURN v_agent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_offer_lead_to_next(uuid) TO authenticated, service_role;

-- 3) Agent accepts the offer: lock it, keep 120s as first-call timer.
CREATE OR REPLACE FUNCTION public.orr_accept_offer(_lead uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agent uuid;
  v_now timestamptz := now();
BEGIN
  SELECT au.id INTO v_agent FROM public.admin_users au WHERE au.user_id = v_uid LIMIT 1;
  IF v_agent IS NULL THEN RETURN false; END IF;

  UPDATE public.sales_leads
     SET pool_status = 'calling_locked',
         locked_by = v_agent,
         locked_at = v_now,
         orr_first_call_deadline = v_now + interval '120 seconds',
         orr_offer_expires_at = NULL,
         updated_at = v_now
   WHERE id = _lead
     AND assigned_to = v_agent
     AND pool_status = 'offered';

  IF FOUND THEN
    UPDATE public.agent_distribution_caps
       SET assigned_today = COALESCE(assigned_today,0) + 1
     WHERE admin_user_id = v_agent;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_accept_offer(uuid) TO authenticated, service_role;

-- 4) Agent passes: mark them as passed, offer to next.
CREATE OR REPLACE FUNCTION public.orr_pass_offer(_lead uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_agent uuid;
BEGIN
  SELECT au.id INTO v_agent FROM public.admin_users au WHERE au.user_id = v_uid LIMIT 1;
  IF v_agent IS NULL THEN RETURN NULL; END IF;

  UPDATE public.sales_leads
     SET orr_offer_passed_by = array_append(COALESCE(orr_offer_passed_by,'{}'::uuid[]), v_agent),
         assigned_to = NULL,
         owner_agent = NULL,
         pool_status = 'new',
         orr_first_call_deadline = NULL,
         orr_offer_expires_at = NULL,
         updated_at = now()
   WHERE id = _lead
     AND assigned_to = v_agent
     AND pool_status = 'offered';

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN public.orr_offer_lead_to_next(_lead);
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_pass_offer(uuid) TO authenticated, service_role;

-- 5) Sweeper - reoffer expired offers. Run via cron every 30s.
CREATE OR REPLACE FUNCTION public.orr_sweep_expired_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT id, assigned_to
      FROM public.sales_leads
     WHERE pool_status = 'offered'
       AND orr_offer_expires_at IS NOT NULL
       AND orr_offer_expires_at < now()
     ORDER BY orr_offer_expires_at
     LIMIT 200
  LOOP
    UPDATE public.sales_leads
       SET orr_offer_passed_by =
             CASE WHEN r.assigned_to IS NOT NULL
                  THEN array_append(COALESCE(orr_offer_passed_by,'{}'::uuid[]), r.assigned_to)
                  ELSE COALESCE(orr_offer_passed_by,'{}'::uuid[]) END,
           assigned_to = NULL,
           owner_agent = NULL,
           pool_status = 'new',
           orr_first_call_deadline = NULL,
           orr_offer_expires_at = NULL,
           updated_at = now()
     WHERE id = r.id;

    PERFORM public.orr_offer_lead_to_next(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.orr_sweep_expired_offers() TO authenticated, service_role;

-- 6) Intake trigger - offer new unassigned ORR-eligible leads.
CREATE OR REPLACE FUNCTION public.trg_orr_offer_on_intake_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL
     AND COALESCE(NEW.is_paid,false) = false
     AND (NEW.status IS NULL OR NEW.status = 'new'::lead_status)
     AND COALESCE(NEW.queue::text,'live_open_pool') IN ('live_open_pool','')
     AND EXISTS (
       SELECT 1 FROM public.agent_distribution_caps adc
       JOIN public.admin_users au ON au.id = adc.admin_user_id
       WHERE au.is_active = true
         AND au.role IN ('sales','sales_lead')
         AND COALESCE(adc.paused,false) = false
         AND COALESCE(adc.assignment_mode,'round_robin') = 'open_pool'
     )
  THEN
    PERFORM public.orr_offer_lead_to_next(NEW.id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orr_offer_on_intake ON public.sales_leads;
CREATE TRIGGER trg_orr_offer_on_intake
  AFTER INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.trg_orr_offer_on_intake_fn();

-- 7) Schedule the sweeper (pg_cron).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('orr-sweep-expired-offers')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'orr-sweep-expired-offers');
    PERFORM cron.schedule(
      'orr-sweep-expired-offers',
      '*/1 * * * *',
      $sql$ SELECT public.orr_sweep_expired_offers(); $sql$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
