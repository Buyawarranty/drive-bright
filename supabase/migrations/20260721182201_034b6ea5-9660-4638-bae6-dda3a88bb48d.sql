
ALTER TABLE public.customer_documents
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS effective_from date,
  ADD COLUMN IF NOT EXISTS effective_to date;

-- Backfill effective_from from created_at for existing rows
UPDATE public.customer_documents
   SET effective_from = created_at::date
 WHERE effective_from IS NULL;

CREATE INDEX IF NOT EXISTS customer_documents_plan_effective_idx
  ON public.customer_documents (plan_type, effective_from DESC);

-- Seed the two uploaded versions (idempotent)
INSERT INTO public.customer_documents
  (plan_type, document_name, file_url, file_size, version, effective_from)
VALUES
  ('terms-and-conditions',
   'Terms & Conditions v3.1 (Feb 2026)',
   '/__l5e/assets-v1/208c4e0c-ff52-4c36-80eb-8768e064bb5c/terms-and-conditions-v3.1-2026-02.pdf',
   4763793,
   'v3.1',
   DATE '2026-02-01'),
  ('platinum',
   'Platinum Warranty Plan v3.1 (Feb 2026)',
   '/__l5e/assets-v1/61bb04e2-e01c-4b48-ad6b-2ba08a5e0a58/Platinum-Warranty-Plan-v3.1.pdf',
   9268846,
   'v3.1',
   DATE '2026-02-01')
ON CONFLICT DO NOTHING;

-- Lookup helper: which document version applied to a plan on a given date?
CREATE OR REPLACE FUNCTION public.get_document_version_for_date(
  _plan_type text,
  _on_date date
) RETURNS TABLE (
  id uuid,
  plan_type text,
  document_name text,
  file_url text,
  version text,
  effective_from date,
  effective_to date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, plan_type, document_name, file_url, version, effective_from, effective_to
    FROM public.customer_documents
   WHERE plan_type = _plan_type
     AND COALESCE(effective_from, created_at::date) <= _on_date
     AND (effective_to IS NULL OR effective_to >= _on_date)
   ORDER BY COALESCE(effective_from, created_at::date) DESC
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_document_version_for_date(text, date) TO anon, authenticated, service_role;
