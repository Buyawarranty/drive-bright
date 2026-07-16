
-- =====================================================================
-- 1. TIGHTEN THE RPC: Open Pool bulk-assign only ever picks status='new'
-- =====================================================================
CREATE OR REPLACE FUNCTION public.open_pool_bulk_assign_to_agent(_target_admin_id uuid, _count integer, _window_minutes integer DEFAULT 30)
 RETURNS TABLE(assigned_count integer, lead_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_role text;
  _target_user_id uuid;
  _target_active boolean;
  _ids uuid[];
  _deadline timestamptz;
  _no_timer boolean;
  _new_queue text;
  _log_desc text;
  _note_text text;
BEGIN
  IF _count IS NULL OR _count < 1 THEN
    RAISE EXCEPTION 'Count must be at least 1';
  END IF;
  IF _count > 50 THEN
    _count := 50;
  END IF;

  _no_timer := (_window_minutes IS NULL OR _window_minutes <= 0);

  IF NOT _no_timer THEN
    IF _window_minutes < 5 THEN _window_minutes := 5; END IF;
    IF _window_minutes > 240 THEN _window_minutes := 240; END IF;
    _deadline := now() + make_interval(mins => _window_minutes);
    _new_queue := 'retry_queue';
    _log_desc := 'Assigned from Open Pool by manager (never-contacted lead) — ' || _window_minutes || '-minute call window.';
  ELSE
    _deadline := NULL;
    _new_queue := 'owned_by_agent';
    _log_desc := 'Assigned from Open Pool by manager (never-contacted lead) — no time limit (owned by agent).';
  END IF;

  SELECT role INTO _caller_role
    FROM admin_users
   WHERE user_id = auth.uid() AND is_active = true
   LIMIT 1;

  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not authorized to assign Open Pool leads';
  END IF;

  SELECT user_id, is_active
    INTO _target_user_id, _target_active
    FROM admin_users
   WHERE id = _target_admin_id
   LIMIT 1;

  IF _target_user_id IS NULL THEN RAISE EXCEPTION 'Target agent not found'; END IF;
  IF NOT _target_active THEN RAISE EXCEPTION 'Target agent is not active'; END IF;

  WITH picked AS (
    SELECT sl.id
      FROM sales_leads sl
     WHERE sl.queue = 'live_open_pool'
       AND sl.owner_agent IS NULL
       AND sl.assigned_to IS NULL
       AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
       AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
       -- HARD RULE: only never-contacted leads may leave the pool via bulk assign.
       -- Anything past 'new' is already owned by the agent who touched it.
       AND sl.status = 'new'
       AND (sl.pool_status IS NULL OR sl.pool_status = 'new')
     ORDER BY
       COALESCE(sl.priority_score, 0) DESC,
       sl.created_at ASC
     LIMIT _count
     FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE sales_leads sl
       SET owner_agent          = _target_admin_id,
           assigned_to          = _target_admin_id,
           assigned_at          = COALESCE(sl.assigned_at, now()),
           locked_by            = _target_user_id,
           locked_at            = now(),
           queue                = _new_queue,
           pool_status          = 'new',
           next_action_at       = _deadline,
           last_action_at       = now(),
           last_resubmitted_at  = now(),
           updated_at           = now()
      FROM picked p
     WHERE sl.id = p.id
    RETURNING sl.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM upd;

  IF array_length(_ids, 1) IS NOT NULL THEN
    INSERT INTO lead_activities (lead_id, activity_type, description)
    SELECT lid, 'system', _log_desc
      FROM unnest(_ids) AS lid;

    _note_text := '[System] Assigned from Open Pool — never-contacted lead. Please make first contact.';
    INSERT INTO lead_quick_notes (lead_id, note_text, created_by, is_pinned)
    SELECT lid, _note_text, _target_admin_id, false
      FROM unnest(_ids) AS lid;
  END IF;

  assigned_count := COALESCE(array_length(_ids, 1), 0);
  lead_ids := _ids;
  RETURN NEXT;
END;
$function$;

-- =====================================================================
-- 2. CLEAN UP: worked leads still stuck in 'live_open_pool' queue.
-- If a lead has assigned_to set AND status is past 'new', move it out of
-- the pool queue and into that agent's own queue. Also promote assigned_to
-- to owner_agent so it truly belongs to them.
-- =====================================================================
UPDATE public.sales_leads
   SET queue        = 'owned_by_agent',
       owner_agent  = COALESCE(owner_agent, assigned_to),
       updated_at   = now()
 WHERE queue = 'live_open_pool'
   AND assigned_to IS NOT NULL
   AND status IN ('contacted','quote_sent','follow_up','negotiating','urgent_callback');

-- =====================================================================
-- 3. Terminal leads sitting in the pool: park them so they never surface.
-- =====================================================================
UPDATE public.sales_leads
   SET queue      = 'closed',
       updated_at = now()
 WHERE queue = 'live_open_pool'
   AND status IN ('lost','converted','fake_lead');
