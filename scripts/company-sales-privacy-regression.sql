-- Read-only role checks in a rolled-back transaction; no account is changed.
BEGIN;
DO $test$
DECLARE staff record; r record; n integer; checked integer := 0;
BEGIN
  FOR staff IN SELECT id,user_id,role FROM public.admin_users
    WHERE is_active AND role IN ('sales','sales_lead') AND user_id IS NOT NULL
  LOOP
    PERFORM set_config('request.jwt.claim.sub',staff.user_id::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    FOR r IN SELECT * FROM public.get_team_scoreboard(date_trunc('month',now()),now()) LOOP
      IF r.admin_user_id IS DISTINCT FROM staff.id OR NOT r.is_self
         OR r.team_revenue IS NOT NULL OR r.team_pct IS NOT NULL THEN
        RAISE EXCEPTION 'Sales scoreboard disclosed other staff or team totals';
      END IF;
    END LOOP;
    BEGIN
      PERFORM * FROM public.get_social_analytics(now()-interval '1 day',now());
      RAISE EXCEPTION 'Sales social report was not denied';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.offline_campaign_monthly_stats(ARRAY['SW'],current_date-1,current_date);
      RAISE EXCEPTION 'Sales campaign report was not denied';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.postcode_area_monthly_sales(current_date-1,current_date);
      RAISE EXCEPTION 'Sales area report was not denied';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN
      PERFORM * FROM public.postcode_district_stats(current_date-1,current_date,'SW');
      RAISE EXCEPTION 'Sales district report was not denied';
    EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF NOT public.is_two_month_sales_scope(staff.user_id) THEN
      RAISE EXCEPTION 'Sales target restriction predicate did not match';
    END IF;
    checked := checked + 1;
  END LOOP;
  IF checked = 0 THEN RAISE EXCEPTION 'No sales accounts available for privacy checks'; END IF;
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public'
    AND tablename='monthly_revenue_targets' AND permissive='RESTRICTIVE'
    AND qual LIKE '%is_two_month_sales_scope%';
  IF n<>1 THEN RAISE EXCEPTION 'Company target restrictive policy missing'; END IF;
  RAISE NOTICE 'Sales privacy checks passed for % active accounts',checked;
END $test$;
ROLLBACK;