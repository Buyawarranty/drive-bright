DO $test$
DECLARE staff record; r record; checked integer := 0;
BEGIN
  FOR staff IN SELECT id,user_id,role FROM public.admin_users WHERE is_active AND role IN ('sales','sales_lead') AND user_id IS NOT NULL LOOP
    PERFORM set_config('request.jwt.claim.sub',staff.user_id::text,true);
    FOR r IN SELECT * FROM public.get_team_scoreboard(date_trunc('month',now()),now()) LOOP
      IF r.admin_user_id IS DISTINCT FROM staff.id OR NOT r.is_self OR r.team_revenue IS NOT NULL OR r.team_pct IS NOT NULL THEN RAISE EXCEPTION 'Scoreboard privacy failed'; END IF;
    END LOOP;
    BEGIN PERFORM * FROM public.get_social_analytics(now()-interval '1 day',now()); RAISE EXCEPTION 'Social report not denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM * FROM public.offline_campaign_monthly_stats(ARRAY['SW'],current_date-1,current_date); RAISE EXCEPTION 'Campaign report not denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM * FROM public.postcode_area_monthly_sales(current_date-1,current_date); RAISE EXCEPTION 'Area report not denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    BEGIN PERFORM * FROM public.postcode_district_stats(current_date-1,current_date,'SW'); RAISE EXCEPTION 'District report not denied'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    IF NOT public.is_two_month_sales_scope(staff.user_id) THEN RAISE EXCEPTION 'Target predicate failed'; END IF;
    checked := checked + 1;
  END LOOP;
  IF checked=0 THEN RAISE EXCEPTION 'No sales accounts tested'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='monthly_revenue_targets' AND permissive='RESTRICTIVE' AND qual LIKE '%is_two_month_sales_scope%') THEN RAISE EXCEPTION 'Target privacy policy missing'; END IF;
  RAISE NOTICE 'Privacy checks passed for % accounts',checked;
END $test$;