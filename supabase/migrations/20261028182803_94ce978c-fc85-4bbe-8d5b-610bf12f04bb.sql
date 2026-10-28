DO $tests$
DECLARE staff record; permitted boolean; contact record;
BEGIN
 FOR staff IN SELECT user_id,id,role::text role FROM public.admin_users WHERE is_active AND archived_at IS NULL LOOP
  PERFORM set_config('request.jwt.claim.sub',staff.user_id::text,true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  permitted := private_lead_access.can_access_checkout_alert(NULL,NULL);
  IF permitted IS DISTINCT FROM (staff.role IN ('admin','super_admin'))
  THEN RAISE EXCEPTION 'Unassigned alert role rule failed: %',staff.role; END IF;
  EXECUTE 'RESET ROLE';
  IF staff.role IN ('sales','sales_lead') THEN
   FOR contact IN SELECT email,phone,assigned_to FROM public.sales_leads
    WHERE NOT coalesce(management_hold,false) AND assigned_to IS NOT NULL
    ORDER BY created_at DESC LIMIT 20 LOOP
    EXECUTE 'SET LOCAL ROLE authenticated';
    permitted := private_lead_access.can_access_checkout_alert(contact.email,contact.phone);
    IF contact.assigned_to<>staff.id AND permitted
    THEN RAISE EXCEPTION 'Other agents alert visible'; END IF;
    EXECUTE 'RESET ROLE';
   END LOOP;
  END IF;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','',true);
 RAISE NOTICE 'PASS: checkout alert role and ownership rules';
END;
$tests$;