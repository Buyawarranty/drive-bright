CREATE TABLE IF NOT EXISTS public.vehicle_exclusion_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  status text NOT NULL DEFAULT 'live',
  extra_makes jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_model_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing_version_label text,
  notes text,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vehicle_exclusion_versions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_exclusion_versions TO authenticated;
GRANT ALL ON public.vehicle_exclusion_versions TO service_role;

ALTER TABLE public.vehicle_exclusion_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published vehicle exclusions" ON public.vehicle_exclusion_versions;
CREATE POLICY "Anyone can read published vehicle exclusions"
ON public.vehicle_exclusion_versions FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Management can publish vehicle exclusions" ON public.vehicle_exclusion_versions;
CREATE POLICY "Management can publish vehicle exclusions"
ON public.vehicle_exclusion_versions FOR ALL
TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_vehicle_exclusion_versions_live ON public.vehicle_exclusion_versions (status, published_at DESC);