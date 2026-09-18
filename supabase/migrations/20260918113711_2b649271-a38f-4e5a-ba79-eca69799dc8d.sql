CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
RETURNS TABLE(lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE _picked uuid; _now timestamptz:=now(); _admin_id uuid; _auth_id uuid;
BEGIN
  SELECT id,user_id INTO _admin_id,_auth_id FROM admin_users WHERE (id=_agent OR user_id=_agent) AND is_active=true LIMIT 1;
  IF _admin_id IS NULL THEN RAISE EXCEPTION 'Active agent not found'; END IF;

  SELECT id INTO _picked FROM sales_leads
   WHERE locked_by IN (_agent,_admin_id,_auth_id) AND pool_status='calling_locked' AND owner_agent IS NULL
   ORDER BY locked_at DESC NULLS LAST LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF _picked IS NULL THEN
    SELECT id INTO _picked FROM sales_leads
     WHERE COALESCE(is_paid,false)=false AND status NOT IN ('converted','lost','fake_lead','not_interested','wrong_number','do_not_contact','not_eligible','unsubscribed')
       AND owner_agent IS NULL AND assigned_to IS NULL
       AND queue IN ('live_open_pool','retry_queue')
       AND pool_status IN ('new','contacted')
       AND COALESCE(next_action_at,eligible_at,orr_pool_next_open_at,_now)<=_now
     ORDER BY CASE WHEN queue='retry_queue' THEN 0 ELSE 1 END, COALESCE(next_action_at,eligible_at,created_at) ASC, created_at ASC
     LIMIT 1 FOR UPDATE SKIP LOCKED;
  END IF;

  IF _picked IS NULL THEN RETURN; END IF;

  UPDATE sales_leads SET assigned_to=_admin_id, owner_agent=NULL, assigned_at=_now,
    locked_by=COALESCE(_auth_id,_agent), locked_at=_now, pool_status='calling_locked', queue=CASE WHEN queue='retry_queue' THEN 'retry_queue' ELSE 'live_open_pool' END,
    orr_first_call_deadline=_now+interval '120 seconds', updated_at=_now WHERE id=_picked;

  lead_id:=_picked; RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.open_pool_get_next(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pool_get_next(uuid) TO authenticated, service_role;