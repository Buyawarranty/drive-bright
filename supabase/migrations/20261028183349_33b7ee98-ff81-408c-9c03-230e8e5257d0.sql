DO $tests$
DECLARE actor record; own_lead uuid; other_actor uuid; event_row public.lead_access_events%ROWTYPE;
BEGIN
 SELECT id,user_id INTO STRICT actor FROM public.admin_users WHERE is_active AND archived_at IS NULL AND role::text='sales' ORDER BY id LIMIT 1;
 SELECT id INTO STRICT own_lead FROM public.sales_leads WHERE assigned_to=actor.id AND NOT coalesce(management_hold,false) LIMIT 1;
 SELECT id INTO STRICT other_actor FROM public.admin_users WHERE id<>actor.id LIMIT 1;
 BEGIN
  PERFORM set_config('request.jwt.claim.sub',actor.user_id::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.lead_access_events(lead_id,actor_id,action,source,occurred_at)
  VALUES(own_lead,other_actor,'phone_copy','audit_test','2000-01-01');
  EXECUTE 'RESET ROLE';
  SELECT * INTO STRICT event_row FROM public.lead_access_events WHERE lead_id=own_lead AND source='audit_test' ORDER BY occurred_at DESC LIMIT 1;
  IF event_row.actor_id<>actor.id OR event_row.occurred_at<>now() THEN RAISE EXCEPTION 'Actor/time spoof accepted'; END IF;
  IF has_table_privilege('authenticated','public.lead_access_events','UPDATE') OR has_table_privilege('authenticated','public.lead_access_events','DELETE') THEN RAISE EXCEPTION 'History is mutable'; END IF;
  RAISE EXCEPTION USING ERRCODE='ZX002',MESSAGE='Roll back audit fixture';
 EXCEPTION WHEN SQLSTATE 'ZX002' THEN NULL;
 END;
 RAISE NOTICE 'PASS: server-owned actor/time and append-only access history';
END;
$tests$;