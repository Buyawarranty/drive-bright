-- Run with the migration tool. No customer or assignment records are changed.
DO $tests$
DECLARE
 v_sales uuid; v_admin uuid; v_agent uuid; v_other uuid;
 v_lead uuid; v_email text; v_phone9 text; v_count integer;
BEGIN
 SELECT user_id,id INTO STRICT v_sales,v_agent FROM public.admin_users
 WHERE is_active AND archived_at IS NULL AND role::text='sales' ORDER BY id LIMIT 1;
 SELECT user_id INTO STRICT v_admin FROM public.admin_users
 WHERE is_active AND archived_at IS NULL AND role::text IN ('admin','super_admin') ORDER BY id LIMIT 1;
 SELECT id,email,right(public.normalize_uk_phone(phone),9),assigned_to
 INTO STRICT v_lead,v_email,v_phone9,v_other FROM public.sales_leads
 WHERE assigned_to IS NOT NULL AND assigned_to<>v_agent AND NOT coalesce(management_hold,false)
 ORDER BY created_at DESC LIMIT 1;

 PERFORM set_config('request.jwt.claim.sub',v_sales::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO v_count FROM public.sales_leads WHERE assigned_to=v_agent;
 IF v_count=0 THEN RAISE EXCEPTION 'Sales cannot read their own leads'; END IF;
 SELECT count(*) INTO v_count FROM public.sales_leads WHERE assigned_to IS DISTINCT FROM v_agent OR management_hold;
 IF v_count<>0 THEN RAISE EXCEPTION 'Sales can read other, unassigned or held leads'; END IF;
 SELECT count(*) INTO v_count FROM public.checkout_struggle_alerts
 WHERE NOT private_lead_access.can_access_checkout_alert(customer_email,customer_phone);
 IF v_count<>0 THEN RAISE EXCEPTION 'Sales can read another agents checkout alerts'; END IF;
 IF private_lead_access.can_access_checkout_alert(v_email,v_phone9) IS TRUE
 THEN RAISE EXCEPTION 'Another agents contact passes alert ownership'; END IF;
 SELECT count(*) INTO v_count FROM public.find_lead_owner_by_contact(v_email,v_phone9) WHERE id=v_lead;
 IF v_count<>0 THEN RAISE EXCEPTION 'Contact lookup exposes another agents lead'; END IF;
 EXECUTE 'RESET ROLE';

 -- Exercise sales_lead with the same real account inside a rolled-back subtransaction.
 BEGIN
  UPDATE public.admin_users SET role='sales_lead' WHERE id=v_agent;
  PERFORM set_config('request.jwt.claim.sub',v_sales::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO v_count FROM public.sales_leads WHERE assigned_to IS DISTINCT FROM v_agent OR management_hold;
  IF v_count<>0 THEN RAISE EXCEPTION 'Sales lead can read other, unassigned or held leads'; END IF;
  IF private_lead_access.can_access_checkout_alert(v_email,v_phone9) IS TRUE
  THEN RAISE EXCEPTION 'Sales lead can access another agents alert'; END IF;
  SELECT count(*) INTO v_count FROM public.find_lead_owner_by_contact(v_email,v_phone9) WHERE id=v_lead;
  IF v_count<>0 THEN RAISE EXCEPTION 'Sales lead contact lookup exposes another lead'; END IF;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='Rollback temporary test role';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 IF (SELECT role::text FROM public.admin_users WHERE id=v_agent)<>'sales'
 THEN RAISE EXCEPTION 'Temporary test role was not rolled back'; END IF;

 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 SELECT count(*) INTO v_count FROM public.sales_leads WHERE id=v_lead;
 IF v_count<>1 THEN RAISE EXCEPTION 'Management lost lead access'; END IF;
 IF NOT private_lead_access.can_access_checkout_alert(v_email,v_phone9)
 THEN RAISE EXCEPTION 'Management lost checkout alert access'; END IF;
 EXECUTE 'RESET ROLE';
 PERFORM set_config('request.jwt.claim.sub','',true);
 RAISE NOTICE 'PASS: sales and sales_lead ownership, contact lookup, management access and test rollback';
END;
$tests$;