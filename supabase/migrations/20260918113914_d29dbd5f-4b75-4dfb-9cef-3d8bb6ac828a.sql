CREATE OR REPLACE FUNCTION public.orr_offer_lead_to_next(_lead uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_lead RECORD; v_agent uuid; v_now timestamptz:=now(); v_london timestamptz:=(v_now AT TIME ZONE 'Europe/London'); v_hour int:=extract(hour from v_london)::int;
BEGIN
  SELECT id,assigned_to,pool_status,orr_offer_passed_by,eligible_at,orr_pool_next_open_at,status,is_paid INTO v_lead FROM public.sales_leads WHERE id=_lead FOR UPDATE;
  IF v_lead.id IS NULL OR COALESCE(v_lead.is_paid,false) THEN RETURN NULL; END IF;
  IF (v_lead.eligible_at IS NOT NULL AND v_lead.eligible_at>v_now) OR (v_lead.orr_pool_next_open_at IS NOT NULL AND v_lead.orr_pool_next_open_at>v_now) OR v_hour<9 OR v_hour>=18 THEN RETURN NULL; END IF;
  SELECT adc.admin_user_id INTO v_agent FROM public.agent_distribution_caps adc JOIN public.admin_users au ON au.id=adc.admin_user_id
   WHERE au.is_active=true AND au.role IN ('sales','sales_lead') AND COALESCE(adc.paused,false)=false
     AND COALESCE(adc.assignment_mode,'round_robin')='open_pool' AND public.is_agent_on_duty(adc.admin_user_id)
     AND (adc.daily_cap IS NULL OR adc.assigned_today<adc.daily_cap)
     AND NOT (adc.admin_user_id=ANY(COALESCE(v_lead.orr_offer_passed_by,'{}'::uuid[])))
   ORDER BY COALESCE(adc.assigned_today,0),adc.last_assigned_at NULLS FIRST,adc.sort_order LIMIT 1;
  IF v_agent IS NULL THEN
    UPDATE public.sales_leads SET assigned_to=NULL,owner_agent=NULL,pool_status='new',queue='live_open_pool',orr_first_call_deadline=NULL,orr_offer_expires_at=NULL,orr_offer_passed_by='{}'::uuid[],updated_at=v_now WHERE id=_lead;
    RETURN NULL;
  END IF;
  UPDATE public.sales_leads SET assigned_to=v_agent,owner_agent=NULL,assigned_at=v_now,pool_status='new',queue='live_open_pool',orr_first_call_deadline=v_now+interval '120 seconds',orr_offer_expires_at=v_now+interval '120 seconds',updated_at=v_now WHERE id=_lead;
  UPDATE public.agent_distribution_caps SET last_assigned_at=v_now WHERE admin_user_id=v_agent;
  RETURN v_agent;
END;
$function$;

CREATE OR REPLACE FUNCTION public.orr_accept_offer(_lead uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_admin uuid; v_auth uuid:=auth.uid();
BEGIN
  SELECT id INTO v_admin FROM public.admin_users WHERE user_id=v_auth AND is_active=true LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'Active agent not found'; END IF;
  UPDATE public.sales_leads SET pool_status='calling_locked',locked_by=v_auth,locked_at=now(),owner_agent=NULL,assigned_to=v_admin,
    orr_first_call_deadline=now()+interval '120 seconds',orr_offer_expires_at=NULL,updated_at=now()
  WHERE id=_lead AND assigned_to=v_admin AND owner_agent IS NULL AND COALESCE(is_paid,false)=false
    AND (orr_offer_expires_at IS NULL OR orr_offer_expires_at>=now());
  RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.orr_offer_lead_to_next(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orr_offer_lead_to_next(uuid) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.orr_accept_offer(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.orr_accept_offer(uuid) TO authenticated,service_role;