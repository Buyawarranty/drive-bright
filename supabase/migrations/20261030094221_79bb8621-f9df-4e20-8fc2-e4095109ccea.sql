DO $migration$
DECLARE d text; f record;
BEGIN
  SELECT pg_get_functiondef('public.get_team_scoreboard(timestamptz,timestamptz)'::regprocedure) INTO d;
  IF position('OR ltm.team_id IN (' in d)=0 OR position('tt.t_revenue,' in d)=0 THEN RAISE EXCEPTION 'Unexpected scoreboard definition'; END IF;
  d := regexp_replace(d, 'OR ltm\.team_id IN \([[:space:]]*SELECT own_membership\.team_id[[:space:]]*FROM public\.lead_team_members AS own_membership[[:space:]]*WHERE own_membership\.admin_user_id = v_me[[:space:]]*\)', 'OR ltm.admin_user_id = v_me');
  d := replace(d, '    tt.t_revenue,', '    CASE WHEN v_is_mgmt THEN tt.t_revenue ELSE NULL::numeric END,');
  d := replace(d, 'CASE WHEN tt.t_target > 0 THEN ROUND(tt.t_revenue / tt.t_target * 100)::int ELSE NULL END', 'CASE WHEN v_is_mgmt AND tt.t_target > 0 THEN ROUND(tt.t_revenue / tt.t_target * 100)::int ELSE NULL END');
  d := replace(d, 'IF NOT public.is_staff(auth.uid()) THEN', 'IF NOT public.is_active_admin_user(auth.uid()) THEN');
  IF position('OR ltm.admin_user_id = v_me' in d)=0 THEN RAISE EXCEPTION 'Self scope substitution failed'; END IF;
  EXECUTE d;
  FOR f IN SELECT p.oid, p.proname, p.prosrc, pg_get_function_arguments(p.oid) args, pg_get_function_result(p.oid) result
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('get_social_analytics','offline_campaign_monthly_stats','postcode_area_monthly_sales','postcode_district_stats')
  LOOP
    EXECUTE format('CREATE OR REPLACE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $body$ BEGIN IF NOT public.is_active_admin_user(auth.uid()) OR public.is_two_month_sales_scope(auth.uid()) THEN RAISE EXCEPTION ''Company sales reporting is not available for this login'' USING ERRCODE=''42501''; END IF; RETURN QUERY %s END; $body$', f.proname, f.args, f.result, f.prosrc);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.oid::regprocedure);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f.oid::regprocedure);
  END LOOP;
END $migration$;
REVOKE EXECUTE ON FUNCTION public.get_team_scoreboard(timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_scoreboard(timestamptz,timestamptz) TO authenticated, service_role;
CREATE POLICY "Sales staff cannot read company revenue targets" ON public.monthly_revenue_targets AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT public.is_two_month_sales_scope(auth.uid()));