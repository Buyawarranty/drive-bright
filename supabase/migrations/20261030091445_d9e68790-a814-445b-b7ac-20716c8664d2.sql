CREATE OR REPLACE FUNCTION public.staff_departure_customer_visible(_role text,_owned boolean,_signup timestamptz,_approval_expires timestamptz,_at timestamptz) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT (_owned AND (_role NOT IN ('sales','sales_lead') OR coalesce(_signup,_at)>=_at-interval '2 months')) OR (_role IN ('sales','sales_lead') AND _approval_expires>_at); $$;
REVOKE ALL ON FUNCTION public.staff_departure_customer_visible(text,boolean,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.staff_crm_capture(uuid,public.admin_users)'::regprocedure) INTO definition; definition:=replace(definition,'((c.assigned_to=_staff.id OR c.sale_credit_admin_user_id=_staff.id) AND NOT coalesce(c.is_deleted,false) AND (_staff.role::text NOT IN (''sales'',''sales_lead'') OR coalesce(c.signup_date,now_at)>=now_at-interval ''2 months'')) OR (_staff.role::text IN (''sales'',''sales_lead'') AND NOT coalesce(c.is_deleted,false) AND EXISTS(SELECT 1 FROM public.customer_history_access_requests r WHERE r.customer_id=c.id AND r.requester_admin_user_id=_staff.id AND r.status=''approved'' AND r.expires_at>now_at))','NOT coalesce(c.is_deleted,false) AND public.staff_departure_customer_visible(_staff.role::text,(c.assigned_to=_staff.id OR c.sale_credit_admin_user_id=_staff.id),c.signup_date,(SELECT max(r.expires_at) FROM public.customer_history_access_requests r WHERE r.customer_id=c.id AND r.requester_admin_user_id=_staff.id AND r.status=''approved''),now_at)'); EXECUTE definition; END $$;
DO $$ DECLARE fake public.admin_users; first_archive uuid; second_archive uuid; locked boolean:=false; BEGIN
IF NOT public.staff_departure_customer_visible('sales',true,'2026-08-30 09:00Z',NULL,'2026-10-30 09:00Z') THEN RAISE EXCEPTION 'Two month boundary failed'; END IF;
IF public.staff_departure_customer_visible('sales_lead',true,'2026-08-30 08:59Z',NULL,'2026-10-30 09:00Z') THEN RAISE EXCEPTION 'Historic customer leaked'; END IF;
IF NOT public.staff_departure_customer_visible('sales',false,'2026-01-01', '2026-10-31 09:00Z','2026-10-30 09:00Z') THEN RAISE EXCEPTION '24h approval failed'; END IF;
IF public.staff_departure_customer_visible('sales',false,'2026-01-01','2026-10-31 09:00Z','2026-10-31 09:00Z') THEN RAISE EXCEPTION 'Expired approval leaked'; END IF;
IF has_function_privilege('authenticated','public.record_staff_crm_view(text,jsonb,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Client actor spoof possible'; END IF;
IF public.staff_crm_redact('{"token":"secret","nested":{"password":"secret","status":"new"}}') <> '{"nested":{"status":"new"}}'::jsonb THEN RAISE EXCEPTION 'Redaction failed'; END IF;
BEGIN
fake:=jsonb_populate_record(NULL::public.admin_users,jsonb_build_object('id',gen_random_uuid(),'role','sales','is_active',true,'first_name','Isolated departure regression'));
first_archive:=public.staff_archive_open(fake,'regression'); second_archive:=public.staff_archive_open(fake,'regression');
IF first_archive=second_archive OR NOT EXISTS(SELECT 1 FROM public.staff_crm_departures WHERE archive_id=first_archive AND permissions->>'is_active'='true') THEN RAISE EXCEPTION 'Departure persistence failed'; END IF;
BEGIN UPDATE public.staff_crm_departures SET tab='tampered' WHERE archive_id=first_archive; EXCEPTION WHEN OTHERS THEN locked:=true; END;
IF NOT locked THEN RAISE EXCEPTION 'Departure was editable'; END IF;
RAISE EXCEPTION SQLSTATE 'Z0001' USING MESSAGE='rollback isolated regression';
EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL;
END;
END $$;