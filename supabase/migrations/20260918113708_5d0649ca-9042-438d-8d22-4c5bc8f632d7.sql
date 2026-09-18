CREATE OR REPLACE FUNCTION public.rolling_rr_distribute(_batch_cap integer DEFAULT 5, _window_minutes integer DEFAULT 30, _max_total integer DEFAULT 100)
RETURNS TABLE(assigned_count integer, agents_used integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _caller_role text; _agent record; _lead_id uuid; _total integer := 0; _agents integer := 0; _progress boolean := true; _guard integer := 0;
BEGIN
  SELECT role INTO _caller_role FROM admin_users WHERE user_id=auth.uid() AND is_active=true LIMIT 1;
  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN RAISE EXCEPTION 'Not authorized to distribute leads'; END IF;
  IF _batch_cap IS NULL OR _batch_cap<1 THEN _batch_cap:=5; END IF; IF _batch_cap>20 THEN _batch_cap:=20; END IF;
  IF _window_minutes IS NULL OR _window_minutes<5 THEN _window_minutes:=30; END IF; IF _window_minutes>240 THEN _window_minutes:=240; END IF;
  IF _max_total IS NULL OR _max_total<1 THEN _max_total:=100; END IF; IF _max_total>500 THEN _max_total:=500; END IF;
  WHILE _progress AND _total<_max_total AND _guard<2000 LOOP
    _progress:=false; _guard:=_guard+1;
    FOR _agent IN
      SELECT adc.admin_user_id, au.user_id, adc.daily_cap, COALESCE(open_batch.cnt,0) open_batch, COALESCE(today.cnt,0) assigned_today
      FROM agent_distribution_caps adc JOIN admin_users au ON au.id=adc.admin_user_id AND au.is_active=true AND au.role IN ('sales','sales_lead')
      LEFT JOIN LATERAL (SELECT count(*) cnt FROM sales_leads sl WHERE sl.assigned_to=adc.admin_user_id AND sl.status='new' AND sl.owner_agent IS NULL) open_batch ON true
      LEFT JOIN LATERAL (SELECT count(*) cnt FROM sales_leads sl WHERE sl.assigned_to=adc.admin_user_id AND sl.assigned_at>=date_trunc('day',now() AT TIME ZONE 'UTC')) today ON true
      WHERE adc.paused=false AND COALESCE(open_batch.cnt,0)<_batch_cap AND (adc.daily_cap IS NULL OR COALESCE(today.cnt,0)<adc.daily_cap)
      ORDER BY COALESCE(today.cnt,0), adc.last_assigned_at NULLS FIRST, adc.sort_order
    LOOP
      EXIT WHEN _total>=_max_total;
      SELECT sl.id INTO _lead_id FROM sales_leads sl
       WHERE sl.queue='live_open_pool' AND sl.assigned_to IS NULL AND sl.owner_agent IS NULL AND sl.status='new'
       ORDER BY COALESCE(sl.priority_score,0) DESC, sl.created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
      IF _lead_id IS NULL THEN EXIT; END IF;
      UPDATE sales_leads SET assigned_to=_agent.admin_user_id, owner_agent=NULL, assigned_at=now(), locked_by=_agent.user_id,
        locked_at=now(), queue='retry_queue', pool_status='new', next_action_at=now()+make_interval(mins=>_window_minutes),
        orr_first_call_deadline=now()+make_interval(mins=>_window_minutes), last_action_at=now(), updated_at=now() WHERE id=_lead_id;
      UPDATE agent_distribution_caps SET last_assigned_at=now(), updated_at=now() WHERE admin_user_id=_agent.admin_user_id;
      INSERT INTO lead_activities(lead_id,activity_type,description) VALUES(_lead_id,'system','Open Round Robin: reserved for this call attempt with a '||_window_minutes||'-minute first-call window.');
      _total:=_total+1; _progress:=true;
    END LOOP;
  END LOOP;
  SELECT count(DISTINCT assigned_to) INTO _agents FROM sales_leads WHERE owner_agent IS NULL AND orr_first_call_deadline>now();
  assigned_count:=_total; agents_used:=COALESCE(_agents,0); RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rolling_rr_reclaim_overdue()
RETURNS TABLE(reclaimed_count integer, lead_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _caller_role text; _ids uuid[];
BEGIN
  SELECT role INTO _caller_role FROM admin_users WHERE user_id=auth.uid() AND is_active=true LIMIT 1;
  IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN RAISE EXCEPTION 'Not authorized to reclaim leads'; END IF;
  WITH picked AS (
    SELECT sl.id FROM sales_leads sl WHERE sl.assigned_to IS NOT NULL AND sl.owner_agent IS NULL AND sl.status='new'
      AND sl.orr_first_call_deadline IS NOT NULL AND sl.orr_first_call_deadline<now() FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE sales_leads sl SET assigned_to=NULL, owner_agent=NULL, locked_by=NULL, locked_at=NULL, queue='live_open_pool', pool_status='new',
      next_action_at=NULL, orr_first_call_deadline=NULL, orr_first_call_missed_at=now(), orr_first_call_missed_by=sl.assigned_to,
      orr_first_call_missed_count=COALESCE(sl.orr_first_call_missed_count,0)+1, orr_reassign_count=COALESCE(sl.orr_reassign_count,0)+1, updated_at=now()
    FROM picked p WHERE sl.id=p.id RETURNING sl.id
  ) SELECT COALESCE(array_agg(id),ARRAY[]::uuid[]) INTO _ids FROM upd;
  IF array_length(_ids,1) IS NOT NULL THEN
    INSERT INTO lead_activities(lead_id,activity_type,description)
    SELECT lid,'system','Temporary call reservation ended — returned to the pool for the next available agent.' FROM unnest(_ids) lid;
  END IF;
  reclaimed_count:=COALESCE(array_length(_ids,1),0); lead_ids:=_ids; RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.rolling_rr_distribute(integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rolling_rr_distribute(integer,integer,integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rolling_rr_reclaim_overdue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rolling_rr_reclaim_overdue() TO authenticated, service_role;