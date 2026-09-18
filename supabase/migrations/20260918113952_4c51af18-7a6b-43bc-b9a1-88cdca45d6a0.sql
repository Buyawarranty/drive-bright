CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
RETURNS TABLE(lead_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _existing uuid; _picked uuid; _admin_id uuid;
BEGIN
  SELECT id INTO _admin_id FROM public.admin_users WHERE (id=_agent OR user_id=_agent) AND is_active=true LIMIT 1;
  IF _admin_id IS NULL THEN RAISE EXCEPTION 'Active agent not found'; END IF;
  SELECT id INTO _existing FROM public.sales_leads WHERE locked_by=_admin_id AND pool_status='calling_locked' AND owner_agent IS NULL ORDER BY locked_at DESC LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN QUERY SELECT _existing; RETURN; END IF;
  WITH ranked_candidates AS MATERIALIZED (
    SELECT sl.id,sl.email,sl.vehicle_reg,
      CASE WHEN 'paid_google'=ANY(sl.auto_tags) THEN 1 WHEN 'paid_facebook'=ANY(sl.auto_tags) THEN 2
        WHEN 'website_quote'=ANY(sl.auto_tags) AND 'high_priority'=ANY(sl.auto_tags) THEN 3
        WHEN sl.queue='callback_queue' AND sl.next_action_at<=now() THEN 4
        WHEN 'warranty_expiring'=ANY(sl.auto_tags) THEN 5 WHEN 'premium_vehicle'=ANY(sl.auto_tags) THEN 6
        WHEN 'website_quote'=ANY(sl.auto_tags) THEN 7 WHEN COALESCE(sl.call_count,0)=0 THEN 8 WHEN sl.queue='nurture_queue' THEN 9 ELSE 10 END priority_band,
      sl.next_action_at,sl.created_at
    FROM public.sales_leads sl
    WHERE sl.queue IN ('live_open_pool','morning_call_queue','retry_queue','callback_queue','nurture_queue')
      AND (sl.pool_status IS NULL OR sl.pool_status IN ('new','callback_booked','contacted')) AND COALESCE(sl.is_paid,false)=false
      AND sl.status NOT IN ('converted'::lead_status,'fake_lead'::lead_status,'lost'::lead_status)
      AND sl.owner_agent IS NULL AND sl.assigned_to IS NULL AND (sl.locked_by IS NULL OR sl.locked_at<now()-interval '7 minutes')
      AND (sl.next_action_at IS NULL OR sl.next_action_at<=now())
      AND (sl.queue<>'live_open_pool' OR (COALESCE(sl.call_count,0)=0 AND sl.status='new'::lead_status))
      AND (sl.eligible_at IS NULL OR sl.eligible_at<=now()) AND (sl.orr_pool_next_open_at IS NULL OR sl.orr_pool_next_open_at<=now())
    ORDER BY priority_band,sl.next_action_at NULLS LAST,sl.created_at DESC LIMIT 500
  ), eligible AS MATERIALIZED (
    SELECT rc.id,rc.priority_band,rc.next_action_at,rc.created_at FROM ranked_candidates rc
    WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE COALESCE(c.is_deleted,false)=false AND lower(COALESCE(c.status,'')) NOT IN ('cancelled','refunded')
      AND ((COALESCE(rc.email,'')<>'' AND lower(c.email)=lower(rc.email)) OR (COALESCE(rc.vehicle_reg,'')<>'' AND upper(regexp_replace(c.registration_plate,'\s+','','g'))=upper(regexp_replace(rc.vehicle_reg,'\s+','','g')))))
  ) SELECT id INTO _picked FROM eligible ORDER BY priority_band,next_action_at NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _picked IS NULL THEN RETURN; END IF;
  UPDATE public.sales_leads SET assigned_to=_admin_id,owner_agent=NULL,assigned_at=now(),pool_status='calling_locked',locked_by=_admin_id,locked_at=now(),last_action_at=now(),orr_first_call_deadline=now()+interval '120 seconds',updated_at=now() WHERE id=_picked;
  RETURN QUERY SELECT _picked;
END;
$function$;

CREATE OR REPLACE FUNCTION public.orr_accept_offer(_lead uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid;
BEGIN
  SELECT id INTO v_admin FROM public.admin_users WHERE user_id=auth.uid() AND is_active=true LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Active agent not found'; END IF;
  UPDATE public.sales_leads SET pool_status='calling_locked',locked_by=v_admin,locked_at=now(),owner_agent=NULL,assigned_to=v_admin,
    orr_first_call_deadline=now()+interval '120 seconds',orr_offer_expires_at=NULL,updated_at=now()
  WHERE id=_lead AND assigned_to=v_admin AND owner_agent IS NULL AND COALESCE(is_paid,false)=false AND (orr_offer_expires_at IS NULL OR orr_offer_expires_at>=now());
  RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.open_pool_get_next(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.open_pool_get_next(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.orr_accept_offer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orr_accept_offer(uuid) TO authenticated,service_role;