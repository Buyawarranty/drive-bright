CREATE OR REPLACE FUNCTION public.leaver_archive_report(_archive_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '60s' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_active_admin_or_super(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  WITH items AS (
    SELECT source_table,
           NULLIF(row_data->>'created_at','')::timestamptz AS at,
           row_data->>'outcome' AS outcome,
           (row_data->>'contact_made')::text AS contact
    FROM staff_leaver_archive_items WHERE archive_id = _archive_id
  )
  SELECT jsonb_build_object(
    'by_month', (SELECT coalesce(jsonb_agg(m ORDER BY m->>'month'), '[]') FROM (
        SELECT jsonb_build_object('month', to_char(date_trunc('month', at AT TIME ZONE 'Europe/London'), 'YYYY-MM'), 'count', count(*)) m
        FROM items WHERE at IS NOT NULL GROUP BY 1) x),
    'by_hour', (SELECT coalesce(jsonb_agg(h ORDER BY (h->>'hour')::int), '[]') FROM (
        SELECT jsonb_build_object('hour', extract(hour FROM at AT TIME ZONE 'Europe/London')::int, 'count', count(*)) h
        FROM items WHERE at IS NOT NULL GROUP BY extract(hour FROM at AT TIME ZONE 'Europe/London')) x),
    'by_weekday', (SELECT coalesce(jsonb_agg(w ORDER BY (w->>'dow')::int), '[]') FROM (
        SELECT jsonb_build_object('dow', extract(isodow FROM at AT TIME ZONE 'Europe/London')::int, 'count', count(*)) w
        FROM items WHERE at IS NOT NULL GROUP BY extract(isodow FROM at AT TIME ZONE 'Europe/London')) x),
    'call_outcomes', (SELECT coalesce(jsonb_agg(o ORDER BY (o->>'count')::int DESC), '[]') FROM (
        SELECT jsonb_build_object('outcome', coalesce(outcome,'not recorded'), 'count', count(*)) o
        FROM items WHERE source_table = 'lead_call_logs' GROUP BY outcome) x),
    'calls_contact_made', (SELECT count(*) FROM items WHERE source_table='lead_call_logs' AND contact='true'),
    'first_at', (SELECT min(at) FROM items), 'last_at', (SELECT max(at) FROM items)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.leaver_archive_report(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leaver_archive_report(uuid) TO authenticated, service_role;