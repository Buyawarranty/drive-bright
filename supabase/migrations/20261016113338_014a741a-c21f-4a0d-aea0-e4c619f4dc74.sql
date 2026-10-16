CREATE OR REPLACE FUNCTION public.compute_daily_lead_counts(p_date date, p_tz text DEFAULT 'Europe/London')
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (
    SELECT * FROM public.sales_leads
    WHERE (created_at >= (p_date::timestamp AT TIME ZONE p_tz) AND created_at < ((p_date + 1)::timestamp AT TIME ZONE p_tz))
       OR (last_resubmitted_at >= (p_date::timestamp AT TIME ZONE p_tz) AND last_resubmitted_at < ((p_date + 1)::timestamp AT TIME ZONE p_tz))
  )
  SELECT jsonb_build_object(
    'all_leads', count(*),
    'live', count(*) FILTER (WHERE status NOT IN ('lost','fake_lead','archived')),
    'lost', count(*) FILTER (WHERE status = 'lost'),
    'fake', count(*) FILTER (WHERE status = 'fake_lead'),
    'wrong_number', count(*) FILTER (WHERE status = 'wrong_number'),
    'bought_elsewhere', count(*) FILTER (WHERE status = 'bought_elsewhere'),
    'vehicle_sold', count(*) FILTER (WHERE status = 'vehicle_sold'),
    'do_not_contact', count(*) FILTER (WHERE status = 'do_not_contact'),
    'converted', count(*) FILTER (WHERE status = 'converted'),
    'source_google', count(*) FILTER (WHERE lead_source = 'google_ad'),
    'source_facebook', count(*) FILTER (WHERE lead_source = 'social_ad'),
    'source_organic', count(*) FILTER (WHERE lead_source IS NULL OR lead_source = 'website')
  ) FROM base;
$$;
REVOKE ALL ON FUNCTION public.compute_daily_lead_counts(date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_view_lead_count(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = _uid AND COALESCE(au.is_active, true)
      AND au.role::text NOT IN ('sales','sales_lead','sales_manager')
      AND (au.role::text IN ('admin','super_admin') OR (au.permissions->>'tab_lead-count') = 'true')
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_view_lead_count(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lead_count_report(p_from date, p_to date)
RETURNS TABLE(day date, counts jsonb, is_locked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d date; v_today date := (now() AT TIME ZONE 'Europe/London')::date; s jsonb;
BEGIN
  IF NOT public.can_view_lead_count(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to view lead count';
  END IF;
  IF p_to - p_from > 1100 THEN RAISE EXCEPTION 'Date range too long'; END IF;
  d := p_from;
  WHILE d <= LEAST(p_to, v_today) LOOP
    SELECT ds.counts INTO s FROM public.daily_lead_stats_snapshot ds WHERE ds.snapshot_date = d AND ds.team_scope = 'all';
    IF s IS NOT NULL AND d < v_today THEN
      day := d; counts := s; is_locked := true;
    ELSE
      day := d; counts := public.compute_daily_lead_counts(d); is_locked := false;
    END IF;
    RETURN NEXT;
    s := NULL; d := d + 1;
  END LOOP;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_lead_count_report(date, date) TO authenticated;

UPDATE public.admin_users
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"tab_lead-count": true}'::jsonb
WHERE email IN ('abdulnafay2702@gmail.com', 'ads@buyawarranty.co.uk');