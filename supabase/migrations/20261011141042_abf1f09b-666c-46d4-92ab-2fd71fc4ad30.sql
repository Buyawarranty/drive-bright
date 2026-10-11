CREATE TABLE public.checkout_step_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text,
  event text NOT NULL,
  payment_method text,
  amount numeric,
  details jsonb
);
GRANT INSERT ON public.checkout_step_events TO anon, authenticated;
GRANT ALL ON public.checkout_step_events TO service_role;
ALTER TABLE public.checkout_step_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record checkout step events" ON public.checkout_step_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (char_length(event) <= 60 AND (details IS NULL OR pg_column_size(details) < 4000));
CREATE INDEX checkout_step_events_created_idx ON public.checkout_step_events (created_at);

CREATE OR REPLACE FUNCTION public.get_direct_sales_substeps(_from date DEFAULT '2026-03-01')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND is_active = true AND role::text IN ('admin','super_admin')) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('month', m, 'event', event, 'sessions', n) ORDER BY m, event)
    FROM (
      SELECT to_char(date_trunc('month', created_at),'YYYY-MM') m, event, count(DISTINCT coalesce(session_id, id::text)) n
      FROM public.checkout_step_events WHERE created_at >= _from GROUP BY 1,2
    ) x), '[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.get_direct_sales_substeps(date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_direct_sales_substeps(date) TO authenticated;