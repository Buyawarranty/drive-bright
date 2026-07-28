ALTER TABLE public.missed_calls
  ADD COLUMN IF NOT EXISTS offered_to uuid,
  ADD COLUMN IF NOT EXISTS offered_at timestamptz,
  ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_by uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_missed_calls_offer ON public.missed_calls (status, offer_expires_at);

CREATE OR REPLACE FUNCTION public.missed_call_rotate_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agents uuid[];
  v_call record;
  v_next uuid;
  v_rotated integer := 0;
BEGIN
  -- Pool of agents eligible to be offered an inbound missed call:
  -- active sales staff seen in the last 5 minutes and not paused.
  SELECT COALESCE(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
    INTO v_agents
  FROM public.admin_users a
  WHERE a.is_active = true
    AND a.role IN ('sales', 'sales_lead', 'sales_manager')
    AND EXISTS (
      SELECT 1 FROM public.user_presence p
      WHERE p.admin_user_id = a.id
        AND p.last_seen_at > now() - interval '5 minutes'
        AND COALESCE(p.is_paused_receiving, false) = false
    );

  IF array_length(v_agents, 1) IS NULL THEN
    -- Nobody online: fall back to all active sales staff so calls still surface.
    SELECT COALESCE(array_agg(a.id ORDER BY a.id), '{}'::uuid[])
      INTO v_agents
    FROM public.admin_users a
    WHERE a.is_active = true
      AND a.role IN ('sales', 'sales_lead', 'sales_manager');
  END IF;

  IF array_length(v_agents, 1) IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_call IN
    SELECT id, offered_to, declined_by
    FROM public.missed_calls
    WHERE status = 'active'
      AND created_at > now() - interval '1 hour'
      AND (offer_expires_at IS NULL OR offer_expires_at < now())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    -- The agent who let the timer run out counts as having passed.
    IF v_call.offered_to IS NOT NULL AND NOT (v_call.offered_to = ANY(v_call.declined_by)) THEN
      v_call.declined_by := v_call.declined_by || v_call.offered_to;
    END IF;

    SELECT x INTO v_next
    FROM unnest(v_agents) AS x
    WHERE NOT (x = ANY(v_call.declined_by))
    LIMIT 1;

    IF v_next IS NULL THEN
      -- Everyone has passed once — start the loop again.
      v_call.declined_by := '{}'::uuid[];
      v_next := v_agents[1];
    END IF;

    UPDATE public.missed_calls
    SET offered_to = v_next,
        offered_at = now(),
        offer_expires_at = now() + interval '10 seconds',
        declined_by = v_call.declined_by,
        updated_at = now()
    WHERE id = v_call.id;

    v_rotated := v_rotated + 1;
  END LOOP;

  RETURN v_rotated;
END;
$$;

CREATE OR REPLACE FUNCTION public.missed_call_pass(p_call_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid;
BEGIN
  SELECT id INTO v_admin FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1;
  IF v_admin IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.missed_calls
  SET declined_by = CASE WHEN v_admin = ANY(declined_by) THEN declined_by ELSE declined_by || v_admin END,
      offer_expires_at = now() - interval '1 second',
      updated_at = now()
  WHERE id = p_call_id
    AND status = 'active';

  PERFORM public.missed_call_rotate_offers();
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.missed_call_rotate_offers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.missed_call_pass(uuid) TO authenticated;