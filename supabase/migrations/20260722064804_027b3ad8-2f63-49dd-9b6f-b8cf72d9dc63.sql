
-- =========================================================
-- Lock state column
-- =========================================================
ALTER TABLE public.lead_customers
  ADD COLUMN IF NOT EXISTS lock_state text NOT NULL DEFAULT 'eligible'
    CHECK (lock_state IN (
      'eligible','assigned_locked','dialing','call_in_progress',
      'call_completed','cooling_off','contacted_owned','do_not_call','dormant'
    )),
  ADD COLUMN IF NOT EXISTS lock_state_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS lock_agent_id uuid,
  ADD COLUMN IF NOT EXISTS lock_lead_id uuid,
  ADD COLUMN IF NOT EXISTS lock_source text; -- 'manual' | 'auto' | 'reactivation' | 'orr'

CREATE INDEX IF NOT EXISTS idx_lead_customers_lock_state
  ON public.lead_customers (lock_state) WHERE lock_state <> 'eligible';

-- Backfill state from existing flags
UPDATE public.lead_customers SET lock_state = 'do_not_call'    WHERE do_not_call = true    AND lock_state = 'eligible';
UPDATE public.lead_customers SET lock_state = 'dormant'        WHERE dormant = true         AND lock_state = 'eligible';
UPDATE public.lead_customers SET lock_state = 'contacted_owned' WHERE contacted_owner IS NOT NULL AND lock_state = 'eligible';

-- Audit log
CREATE TABLE IF NOT EXISTS public.customer_lock_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    uuid NOT NULL,
  phone_normalized text,
  from_state     text,
  to_state       text NOT NULL,
  agent_id       uuid,
  lead_id        uuid,
  source         text,
  reason         text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customer_lock_events TO authenticated;
GRANT ALL   ON public.customer_lock_events TO service_role;
ALTER TABLE public.customer_lock_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lock events readable by staff" ON public.customer_lock_events;
CREATE POLICY "lock events readable by staff" ON public.customer_lock_events
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_customer_lock_events_customer ON public.customer_lock_events(customer_id, created_at DESC);

-- =========================================================
-- Helper: fetch customer row by phone or by lead
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_customer_for_lead(_lead_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT customer_contact_id FROM public.sales_leads WHERE id = _lead_id;
$$;

-- =========================================================
-- Atomic lock acquisition
-- Returns: (ok boolean, reason text, customer_id uuid, state text)
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_try_acquire_customer_lock(
  _phone_normalized text,
  _agent_id uuid,
  _lead_id uuid,
  _source  text DEFAULT 'orr'
)
RETURNS TABLE (ok boolean, reason text, customer_id uuid, state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust public.lead_customers%ROWTYPE;
BEGIN
  IF _phone_normalized IS NULL OR _phone_normalized = '' THEN
    RETURN QUERY SELECT false, 'invalid_phone', NULL::uuid, NULL::text; RETURN;
  END IF;

  SELECT * INTO v_cust FROM public.lead_customers
   WHERE phone_normalized = _phone_normalized
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'customer_not_found', NULL::uuid, NULL::text; RETURN;
  END IF;

  IF v_cust.lock_state = 'do_not_call' THEN
    RETURN QUERY SELECT false, 'do_not_call', v_cust.id, v_cust.lock_state; RETURN;
  END IF;

  IF v_cust.lock_state = 'dormant' THEN
    RETURN QUERY SELECT false, 'dormant', v_cust.id, v_cust.lock_state; RETURN;
  END IF;

  IF v_cust.lock_state = 'contacted_owned' AND v_cust.contacted_owner <> _agent_id THEN
    RETURN QUERY SELECT false, 'contacted_owned', v_cust.id, v_cust.lock_state; RETURN;
  END IF;

  IF v_cust.lock_state NOT IN ('eligible','cooling_off','call_completed') THEN
    -- assigned_locked / dialing / call_in_progress -> busy
    IF v_cust.lock_agent_id = _agent_id AND v_cust.lock_lead_id = _lead_id THEN
      -- same agent reacquiring their own lock — allow
      RETURN QUERY SELECT true, 'already_locked_self', v_cust.id, v_cust.lock_state; RETURN;
    END IF;
    RETURN QUERY SELECT false, 'already_locked', v_cust.id, v_cust.lock_state; RETURN;
  END IF;

  -- cooling_off: only allow if next_eligible_at has passed
  IF v_cust.lock_state = 'cooling_off'
     AND v_cust.next_eligible_at IS NOT NULL
     AND v_cust.next_eligible_at > now() THEN
    RETURN QUERY SELECT false, 'cooling_off', v_cust.id, v_cust.lock_state; RETURN;
  END IF;

  UPDATE public.lead_customers
     SET lock_state    = 'assigned_locked',
         lock_state_at = now(),
         lock_agent_id = _agent_id,
         lock_lead_id  = _lead_id,
         lock_source   = _source,
         lock_owner    = _agent_id,
         lock_until    = now() + interval '2 minutes',
         updated_at    = now()
   WHERE id = v_cust.id;

  INSERT INTO public.customer_lock_events(customer_id, phone_normalized, from_state, to_state, agent_id, lead_id, source, reason)
  VALUES (v_cust.id, _phone_normalized, v_cust.lock_state, 'assigned_locked', _agent_id, _lead_id, _source, 'acquire');

  RETURN QUERY SELECT true, 'acquired', v_cust.id, 'assigned_locked'; RETURN;
END;
$$;

-- =========================================================
-- Pre-dial gate — MUST be called immediately before dialing
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_can_dial_customer(
  _phone_normalized text,
  _agent_id uuid,
  _lead_id uuid
)
RETURNS TABLE (ok boolean, reason text, state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust public.lead_customers%ROWTYPE;
BEGIN
  SELECT * INTO v_cust FROM public.lead_customers WHERE phone_normalized = _phone_normalized;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'customer_not_found', NULL::text; RETURN;
  END IF;
  IF v_cust.lock_state = 'do_not_call' THEN
    RETURN QUERY SELECT false, 'do_not_call', v_cust.lock_state; RETURN;
  END IF;
  IF v_cust.lock_state IN ('dialing','call_in_progress') AND v_cust.lock_agent_id <> _agent_id THEN
    RETURN QUERY SELECT false, 'busy_other_agent', v_cust.lock_state; RETURN;
  END IF;
  IF v_cust.lock_state = 'contacted_owned' AND v_cust.contacted_owner <> _agent_id THEN
    RETURN QUERY SELECT false, 'contacted_owned', v_cust.lock_state; RETURN;
  END IF;
  IF v_cust.lock_state = 'dormant' THEN
    RETURN QUERY SELECT false, 'dormant', v_cust.lock_state; RETURN;
  END IF;
  IF v_cust.lock_state = 'cooling_off' AND v_cust.next_eligible_at IS NOT NULL AND v_cust.next_eligible_at > now() THEN
    RETURN QUERY SELECT false, 'cooling_off', v_cust.lock_state; RETURN;
  END IF;
  IF v_cust.lock_state = 'assigned_locked' AND v_cust.lock_agent_id <> _agent_id THEN
    RETURN QUERY SELECT false, 'locked_other_agent', v_cust.lock_state; RETURN;
  END IF;
  RETURN QUERY SELECT true, 'ok', v_cust.lock_state;
END;
$$;

-- =========================================================
-- State transitions
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_mark_dialing(_phone_normalized text, _agent_id uuid, _lead_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust public.lead_customers%ROWTYPE; v_ok boolean;
BEGIN
  SELECT * INTO v_cust FROM public.lead_customers WHERE phone_normalized = _phone_normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_cust.lock_state = 'do_not_call' THEN RETURN false; END IF;

  -- Only the current lock owner may transition to dialing
  IF v_cust.lock_state = 'assigned_locked' AND v_cust.lock_agent_id = _agent_id THEN
    UPDATE public.lead_customers
       SET lock_state = 'dialing', lock_state_at = now(), updated_at = now()
     WHERE id = v_cust.id;
    INSERT INTO public.customer_lock_events(customer_id, phone_normalized, from_state, to_state, agent_id, lead_id, reason)
    VALUES (v_cust.id, _phone_normalized, v_cust.lock_state, 'dialing', _agent_id, _lead_id, 'mark_dialing');
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.orr_mark_call_started(_phone_normalized text, _agent_id uuid, _lead_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust public.lead_customers%ROWTYPE;
BEGIN
  SELECT * INTO v_cust FROM public.lead_customers WHERE phone_normalized = _phone_normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_cust.lock_state = 'do_not_call' THEN RETURN false; END IF;
  IF v_cust.lock_agent_id <> _agent_id THEN RETURN false; END IF;

  UPDATE public.lead_customers
     SET lock_state = 'call_in_progress',
         lock_state_at = now(),
         last_call_start = now(),
         lock_until = now() + interval '30 minutes',
         updated_at = now()
   WHERE id = v_cust.id;
  INSERT INTO public.customer_lock_events(customer_id, phone_normalized, from_state, to_state, agent_id, lead_id, reason)
  VALUES (v_cust.id, _phone_normalized, v_cust.lock_state, 'call_in_progress', _agent_id, _lead_id, 'call_started');
  RETURN true;
END;
$$;

-- Outcomes → next state mapping
-- 'converted' → contacted_owned (terminal-ish)
-- 'do_not_call' → do_not_call (terminal)
-- 'callback' → cooling_off + next_eligible_at set by caller
-- default → call_completed (with next_eligible_at optionally set)
CREATE OR REPLACE FUNCTION public.orr_mark_call_ended(
  _phone_normalized text,
  _agent_id uuid,
  _lead_id uuid,
  _outcome text,
  _next_eligible_at timestamptz DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cust public.lead_customers%ROWTYPE;
  v_next text;
BEGIN
  SELECT * INTO v_cust FROM public.lead_customers WHERE phone_normalized = _phone_normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_cust.lock_state = 'do_not_call' THEN RETURN false; END IF;
  IF v_cust.lock_agent_id <> _agent_id THEN RETURN false; END IF;

  IF lower(COALESCE(_outcome,'')) = 'do_not_call' THEN
    v_next := 'do_not_call';
  ELSIF lower(COALESCE(_outcome,'')) IN ('converted','sold','owned') THEN
    v_next := 'contacted_owned';
  ELSIF _next_eligible_at IS NOT NULL AND _next_eligible_at > now() THEN
    v_next := 'cooling_off';
  ELSE
    v_next := 'call_completed';
  END IF;

  UPDATE public.lead_customers
     SET lock_state       = v_next,
         lock_state_at    = now(),
         last_call_end    = now(),
         last_call_outcome= _outcome,
         last_attempt_at  = now(),
         next_eligible_at = COALESCE(_next_eligible_at, next_eligible_at),
         contacted_owner  = CASE WHEN v_next = 'contacted_owned' THEN _agent_id ELSE contacted_owner END,
         contacted_at     = CASE WHEN v_next = 'contacted_owned' THEN now()     ELSE contacted_at END,
         do_not_call      = (v_next = 'do_not_call') OR do_not_call,
         do_not_call_at   = CASE WHEN v_next = 'do_not_call' AND do_not_call_at IS NULL THEN now() ELSE do_not_call_at END,
         lock_agent_id    = CASE WHEN v_next IN ('call_completed','cooling_off') THEN NULL ELSE lock_agent_id END,
         lock_lead_id     = CASE WHEN v_next IN ('call_completed','cooling_off') THEN NULL ELSE lock_lead_id END,
         lock_until       = NULL,
         updated_at       = now()
   WHERE id = v_cust.id;

  INSERT INTO public.customer_lock_events(customer_id, phone_normalized, from_state, to_state, agent_id, lead_id, reason)
  VALUES (v_cust.id, _phone_normalized, v_cust.lock_state, v_next, _agent_id, _lead_id, COALESCE(_outcome,'call_ended'));
  RETURN true;
END;
$$;

-- Release lock without changing attempt count (for preemption / manual release)
CREATE OR REPLACE FUNCTION public.orr_release_customer_lock(_phone_normalized text, _agent_id uuid, _reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cust public.lead_customers%ROWTYPE;
BEGIN
  SELECT * INTO v_cust FROM public.lead_customers WHERE phone_normalized = _phone_normalized FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_cust.lock_state IN ('do_not_call','contacted_owned','dormant') THEN RETURN false; END IF;
  IF v_cust.lock_agent_id IS DISTINCT FROM _agent_id THEN RETURN false; END IF;

  UPDATE public.lead_customers
     SET lock_state    = 'eligible',
         lock_state_at = now(),
         lock_agent_id = NULL,
         lock_lead_id  = NULL,
         lock_until    = NULL,
         updated_at    = now()
   WHERE id = v_cust.id;

  INSERT INTO public.customer_lock_events(customer_id, phone_normalized, from_state, to_state, agent_id, reason)
  VALUES (v_cust.id, _phone_normalized, v_cust.lock_state, 'eligible', _agent_id, COALESCE(_reason,'release'));
  RETURN true;
END;
$$;

-- =========================================================
-- Grants
-- =========================================================
GRANT EXECUTE ON FUNCTION public.orr_try_acquire_customer_lock(text,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orr_can_dial_customer(text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orr_mark_dialing(text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orr_mark_call_started(text,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orr_mark_call_ended(text,uuid,uuid,text,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.orr_release_customer_lock(text,uuid,text) TO authenticated;

-- =========================================================
-- Auto-release stale locks (safety net) — expired lock_until
-- =========================================================
CREATE OR REPLACE FUNCTION public.orr_expire_stale_customer_locks()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n int;
BEGIN
  WITH expired AS (
    UPDATE public.lead_customers
       SET lock_state = 'eligible', lock_state_at = now(), lock_agent_id = NULL, lock_lead_id = NULL, lock_until = NULL, updated_at = now()
     WHERE lock_state IN ('assigned_locked','dialing')
       AND lock_until IS NOT NULL
       AND lock_until < now()
     RETURNING id
  )
  SELECT count(*) INTO v_n FROM expired;
  RETURN v_n;
END;
$$;
