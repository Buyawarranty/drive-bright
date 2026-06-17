CREATE TABLE IF NOT EXISTS public.ab_variant_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_key TEXT NOT NULL,
  variant TEXT NOT NULL CHECK (variant IN ('a','b')),
  session_id TEXT,
  visitor_id TEXT,
  page_path TEXT,
  source TEXT,
  landed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ab_variant_visits_dedup
  ON public.ab_variant_visits (experiment_key, session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ab_variant_visits_lookup
  ON public.ab_variant_visits (experiment_key, variant, landed_at DESC);

GRANT INSERT ON public.ab_variant_visits TO anon, authenticated;
GRANT SELECT ON public.ab_variant_visits TO authenticated;
GRANT ALL ON public.ab_variant_visits TO service_role;

ALTER TABLE public.ab_variant_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an ab visit"
  ON public.ab_variant_visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read ab visits"
  ON public.ab_variant_visits FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_super_admin());