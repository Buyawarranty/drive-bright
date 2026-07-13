
CREATE OR REPLACE FUNCTION public.open_pool_bulk_assign_to_agent(
  _target_admin_id uuid,
  _count integer,
  _window_minutes integer DEFAULT 30
)
RETURNS TABLE(assigned_count integer, lead_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _caller_role text;
  _target_user_id uuid;
  _target_active boolean;
  _ids uuid[];
  _deadline timestamptz;
BEGIN
  IF _count IS NULL OR _count < 1 THEN
    RAISE EXCEPTION 'Count must be at least 1';
  END IF;
  IF _count > 50 THEN
    _count := 50; -- safety cap per click
  END IF;
  _window_minutes := COALESCE(_window_minutes, 30);
  IF _window_minutes < 5 THEN _window_minutes := 5; END IF;
  IF _window_minutes > 240 THEN _window_minutes := 240; END IF;

  -- Authorization: only management may push leads to another agent
  SELECT role INTO _caller_role
    FROM admin_users
   WHERE user_id = auth.uid() AND is_active = true
   LIMIT 1;

  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
    RAISE EXCEPTION 'Not authorized to assign Open Pool leads';
  END IF;

  -- Resolve target agent
  SELECT user_id, is_active
    INTO _target_user_id, _target_active
    FROM admin_users
   WHERE id = _target_admin_id
   LIMIT 1;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target agent not found';
  END IF;
  IF NOT _target_active THEN
    RAISE EXCEPTION 'Target agent is not active';
  END IF;

  _deadline := now() + make_interval(mins => _window_minutes);

  -- Pick top-N available Open Pool leads and assign them atomically
  WITH picked AS (
    SELECT sl.id
      FROM sales_leads sl
     WHERE sl.queue = 'live_open_pool'
       AND (sl.pool_status IS NULL OR sl.pool_status IN ('new','callback_booked','contacted'))
       AND sl.owner_agent IS NULL
       AND sl.assigned_to IS NULL
       AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
       AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
       AND sl.status NOT IN ('lost','converted','fake_lead')
     ORDER BY
       COALESCE(sl.priority_score, 0) DESC,
       sl.created_at ASC
     LIMIT _count
     FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE sales_leads sl
       SET owner_agent    = _target_admin_id,
           assigned_to    = _target_admin_id,
           assigned_at    = COALESCE(sl.assigned_at, now()),
           locked_by      = _target_user_id,
           locked_at      = now(),
           queue          = 'retry_queue',
           pool_status    = 'new',
           next_action_at = _deadline,
           last_action_at = now(),
           updated_at     = now()
      FROM picked p
     WHERE sl.id = p.id
    RETURNING sl.id
  )
  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO _ids FROM upd;

  -- Activity log per lead
  IF array_length(_ids, 1) IS NOT NULL THEN
    INSERT INTO lead_activities (lead_id, activity_type, description)
    SELECT lid,
           'system',
           'Manually assigned from Open Pool by manager — ' || _window_minutes || '-minute call window.'
      FROM unnest(_ids) AS lid;
  END IF;

  assigned_count := COALESCE(array_length(_ids, 1), 0);
  lead_ids := _ids;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_bulk_assign_to_agent(uuid, integer, integer) TO authenticated;
