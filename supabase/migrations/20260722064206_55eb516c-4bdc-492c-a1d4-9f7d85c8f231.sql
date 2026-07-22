
-- =========================================================
-- Audit table for retry-lead releases (never counts an attempt)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.orr_release_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid,
  agent_id     uuid,
  reason       text NOT NULL,
  released_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orr_release_events TO authenticated;
GRANT ALL   ON public.orr_release_events TO service_role;
ALTER TABLE public.orr_release_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "release events readable by staff" ON public.orr_release_events;
CREATE POLICY "release events readable by staff" ON public.orr_release_events
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_orr_release_events_lead ON public.orr_release_events(lead_id, released_at DESC);

-- =========================================================
-- Manual per-agent override (management can force "unavailable")
-- =========================================================
CREATE TABLE IF NOT EXISTS public.orr_agent_status_overrides (
  agent_id     uuid PRIMARY KEY,
  is_available boolean NOT NULL DEFAULT true,
  reason       text,
  set_by       uuid,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orr_agent_status_overrides TO authenticated;
GRANT ALL   ON public.orr_agent_status_overrides TO service_role;
ALTER TABLE public.orr_agent_status_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "overrides readable by staff" ON public.orr_agent_status_overrides;
CREATE POLICY "overrides readable by staff" ON public.orr_agent_status_overrides
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "overrides manageable by management" ON public.orr_agent_status_overrides;
CREATE POLICY "overrides manageable by management" ON public.orr_agent_status_overrides
  FOR ALL TO authenticated
  USING (public.is_management(auth.uid()))
  WITH CHECK (public.is_management(auth.uid()));

-- =========================================================
-- Signal helpers
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_agent_on_active_call(_agent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.zoiper_call_events z
    WHERE z.agent_user_id = _agent_id
      AND z.started_at IS NOT NULL
      AND z.ended_at   IS NULL
      AND z.started_at > now() - interval '1 hour'
  );
$$;

-- Returns the uncalled Team Blue lead currently held by the agent (0 calls, not terminal), or NULL.
CREATE OR REPLACE FUNCTION public.orr_agent_uncalled_hold(_agent_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lead uuid;
BEGIN
  SELECT sl.id INTO v_lead
  FROM public.sales_leads sl
  WHERE sl.assigned_to = _agent_id
    AND public.is_agent_on_team_blue(_agent_id)
    AND COALESCE(sl.status::text, '') NOT IN ('converted','lost','fake_lead','dormant')
    AND sl.orr_dormant_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_call_logs c
      WHERE c.lead_id = sl.id::text AND c.agent_id = _agent_id
    )
  ORDER BY sl.last_claimed_at DESC NULLS LAST, sl.created_at DESC
  LIMIT 1;
  RETURN v_lead;
END;
$$;

CREATE OR REPLACE FUNCTION public.orr_agent_has_open_callback(_agent_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_reminders r
    WHERE r.user_id = _agent_id::text
      AND r.status = 'pending'
      AND lower(COALESCE(r.label,'')) LIKE '%callback%'
      AND COALESCE(r.snoozed_until, r.reminder_time) <= now() + interval '15 minutes'
  );
$$;

-- =========================================================
-- Master availability check
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_is_agent_available(_agent_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_presence public.user_presence%ROWTYPE;
  v_override boolean;
BEGIN
  IF _agent_id IS NULL OR NOT public.is_agent_on_team_blue(_agent_id) THEN
    RETURN false;
  END IF;

  -- Manual override wins
  SELECT is_available INTO v_override FROM public.orr_agent_status_overrides WHERE agent_id = _agent_id;
  IF v_override IS NOT NULL AND v_override = false THEN
    RETURN false;
  END IF;

  -- Logged into CRM (online presence in last 3 min) + not paused
  SELECT * INTO v_presence
  FROM public.user_presence
  WHERE admin_user_id = _agent_id
  ORDER BY last_seen_at DESC NULLS LAST
  LIMIT 1;

  IF v_presence IS NULL
     OR v_presence.status <> 'online'
     OR COALESCE(v_presence.is_paused_receiving, false) = true
     OR v_presence.last_seen_at < now() - interval '3 minutes' THEN
    RETURN false;
  END IF;

  -- Not on an active call
  IF public.orr_agent_on_active_call(_agent_id) THEN
    RETURN false;
  END IF;

  -- Not already holding an uncalled lead
  IF public.orr_agent_uncalled_hold(_agent_id) IS NOT NULL THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- =========================================================
-- Priority engine: returns the top task tier for an agent
-- Tiers: 1=new live, 2=callback, 3=active_sale, 4=overnight_a1, 5=due_retry, 6=admin
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_agent_next_work(_agent_id uuid)
RETURNS TABLE (tier int, kind text, lead_id uuid, due_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid;
BEGIN
  SELECT id INTO v_team_blue FROM public.lead_teams WHERE lower(name) = 'blue' LIMIT 1;
  IF v_team_blue IS NULL OR NOT public.is_agent_on_team_blue(_agent_id) THEN
    RETURN;
  END IF;

  -- Tier 1: waiting live lead (unassigned, live, first attempt)
  RETURN QUERY
  SELECT 1, 'new_live_lead', sl.id, sl.eligible_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_team_blue
    AND sl.intake_class = 'live'
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) = 0
    AND COALESCE(sl.orr_dormant_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
  ORDER BY sl.created_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Tier 2: agreed callback for this agent due now/soon
  RETURN QUERY
  SELECT 2, 'agreed_callback', NULLIF(r.lead_id,'')::uuid, COALESCE(r.snoozed_until, r.reminder_time)
  FROM public.lead_reminders r
  WHERE r.user_id = _agent_id::text
    AND r.status = 'pending'
    AND lower(COALESCE(r.label,'')) LIKE '%callback%'
    AND COALESCE(r.snoozed_until, r.reminder_time) <= now() + interval '15 minutes'
  ORDER BY COALESCE(r.snoozed_until, r.reminder_time) ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Tier 3: active conversation/sale held by this agent (lead assigned, has calls, not converted)
  RETURN QUERY
  SELECT 3, 'active_sale', sl.id, sl.orr_last_attempt_at
  FROM public.sales_leads sl
  WHERE sl.assigned_to = _agent_id
    AND sl.team_id = v_team_blue
    AND COALESCE(sl.status::text, '') NOT IN ('converted','lost','fake_lead','dormant')
    AND EXISTS (SELECT 1 FROM public.lead_call_logs c WHERE c.lead_id = sl.id::text)
  ORDER BY sl.orr_last_attempt_at DESC NULLS LAST
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Tier 4: overnight lead now eligible, no Attempt 1 yet
  RETURN QUERY
  SELECT 4, 'overnight_attempt_1', sl.id, sl.eligible_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_team_blue
    AND sl.intake_class = 'overnight'
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) = 0
    AND sl.eligible_at IS NOT NULL AND sl.eligible_at <= now()
  ORDER BY sl.eligible_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Tier 5: due ORR retry (Attempts 2-7 handled by later prompt, but pre-wire the query)
  RETURN QUERY
  SELECT 5, 'orr_due_retry', sl.id, sl.orr_next_release_at
  FROM public.sales_leads sl
  WHERE sl.team_id = v_team_blue
    AND sl.assigned_to IS NULL
    AND COALESCE(sl.orr_attempt_count, 0) BETWEEN 1 AND 6
    AND sl.orr_next_release_at IS NOT NULL
    AND sl.orr_next_release_at <= now()
    AND sl.orr_dormant_at IS NULL
  ORDER BY sl.orr_next_release_at ASC
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- Tier 6: fallback admin/follow-up
  RETURN QUERY SELECT 6, 'admin_followup', NULL::uuid, NULL::timestamptz;
END;
$$;

-- =========================================================
-- Release an uncalled retry lead without counting an attempt
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_release_retry_hold(_lead_id uuid, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lead public.sales_leads%ROWTYPE;
BEGIN
  SELECT * INTO v_lead FROM public.sales_leads WHERE id = _lead_id FOR UPDATE;
  IF NOT FOUND OR v_lead.assigned_to IS NULL THEN
    RETURN false;
  END IF;

  -- Only release if it's an uncalled retry hold (attempt_count >= 1, no call by this holder)
  IF COALESCE(v_lead.orr_attempt_count, 0) < 1 THEN
    RETURN false; -- not a retry
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.lead_call_logs c
    WHERE c.lead_id = v_lead.id::text AND c.agent_id = v_lead.assigned_to
  ) THEN
    RETURN false; -- already called by this holder; not a release-eligible hold
  END IF;

  INSERT INTO public.orr_release_events(lead_id, agent_id, reason)
  VALUES (v_lead.id, v_lead.assigned_to, COALESCE(_reason, 'priority_preempt'));

  UPDATE public.sales_leads
     SET assigned_to = NULL,
         orr_first_call_deadline = NULL,
         orr_locked_until = NULL,
         orr_next_release_at = COALESCE(orr_next_release_at, now())
         -- IMPORTANT: orr_attempt_count is NOT changed
   WHERE id = _lead_id;

  RETURN true;
END;
$$;

-- =========================================================
-- Return currently-available Team Blue agents (skip busy)
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_pick_available_blue_agents()
RETURNS TABLE (agent_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid;
BEGIN
  SELECT id INTO v_team_blue FROM public.lead_teams WHERE lower(name) = 'blue' LIMIT 1;
  IF v_team_blue IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT ltm.admin_user_id
  FROM public.lead_team_members ltm
  WHERE ltm.team_id = v_team_blue
    AND COALESCE(ltm.workstream_new_leads, false) = true
    AND public.orr_is_agent_available(ltm.admin_user_id);
END;
$$;

-- =========================================================
-- Trigger: when a higher-priority lead is assigned to an agent
-- who is already holding an uncalled retry lead, auto-release the retry.
-- Only fires on Team Blue leads.
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_preempt_retry_on_assign()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team_blue uuid;
  v_hold_id uuid;
  v_new_is_high boolean := false;
BEGIN
  SELECT id INTO v_team_blue FROM public.lead_teams WHERE lower(name) = 'blue' LIMIT 1;
  IF v_team_blue IS NULL THEN RETURN NEW; END IF;
  IF NEW.assigned_to IS NULL OR NEW.team_id <> v_team_blue THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.assigned_to, '00000000-0000-0000-0000-000000000000'::uuid) = NEW.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Higher-priority = new live lead OR agreed callback (attempt_count = 0 and intake=live, OR is_callback)
  v_new_is_high := (COALESCE(NEW.orr_attempt_count,0) = 0 AND NEW.intake_class = 'live')
                    OR COALESCE(NEW.is_callback, false) = true;

  IF NOT v_new_is_high THEN RETURN NEW; END IF;

  v_hold_id := public.orr_agent_uncalled_hold(NEW.assigned_to);
  IF v_hold_id IS NOT NULL AND v_hold_id <> NEW.id THEN
    PERFORM public.orr_release_retry_hold(v_hold_id, 'preempted_by_higher_priority');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orr_preempt_retry_on_assign ON public.sales_leads;
CREATE TRIGGER trg_orr_preempt_retry_on_assign
  AFTER INSERT OR UPDATE OF assigned_to ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.orr_preempt_retry_on_assign();
