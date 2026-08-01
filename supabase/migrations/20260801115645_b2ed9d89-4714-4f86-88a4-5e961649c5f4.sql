CREATE TABLE public.pricing_matrix_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL DEFAULT 'Draft pricing',
  status text NOT NULL DEFAULT 'draft',
  admin_matrix jsonb NOT NULL,
  step3_discount_pct numeric NOT NULL DEFAULT 10,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid
);

CREATE UNIQUE INDEX pricing_matrix_versions_one_live
  ON public.pricing_matrix_versions ((status)) WHERE status = 'live';

GRANT SELECT ON public.pricing_matrix_versions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_matrix_versions TO authenticated;
GRANT ALL ON public.pricing_matrix_versions TO service_role;

ALTER TABLE public.pricing_matrix_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read the live pricing version"
  ON public.pricing_matrix_versions FOR SELECT
  USING (status = 'live');

CREATE POLICY "Management can read all pricing versions"
  ON public.pricing_matrix_versions FOR SELECT TO authenticated
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management can create pricing versions"
  ON public.pricing_matrix_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can update pricing versions"
  ON public.pricing_matrix_versions FOR UPDATE TO authenticated
  USING (public.is_management(auth.uid()))
  WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can delete pricing versions"
  ON public.pricing_matrix_versions FOR DELETE TO authenticated
  USING (public.is_management(auth.uid()));

CREATE TRIGGER pricing_matrix_versions_updated_at
  BEFORE UPDATE ON public.pricing_matrix_versions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.publish_pricing_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only management can publish pricing';
  END IF;

  UPDATE public.pricing_matrix_versions
     SET status = 'archived'
   WHERE status = 'live' AND id <> _version_id;

  UPDATE public.pricing_matrix_versions
     SET status = 'live',
         published_at = now(),
         published_by = auth.uid()
   WHERE id = _version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revert_pricing_to_code_defaults()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only management can revert pricing';
  END IF;

  UPDATE public.pricing_matrix_versions
     SET status = 'archived'
   WHERE status = 'live';
END;
$$;