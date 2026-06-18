
-- Latest template PDFs (single source of truth — update this function when uploading new versions)
CREATE OR REPLACE FUNCTION public.current_policy_pdf_urls()
RETURNS TABLE (terms_url text, platinum_url text)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf'::text,
    'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf'::text
$$;

-- Trigger: auto-populate missing PDF URLs on every new policy.
-- Always fills NULLs only — never overwrites a value already set by upstream code.
CREATE OR REPLACE FUNCTION public.populate_policy_pdf_urls()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms text;
  v_platinum text;
BEGIN
  SELECT terms_url, platinum_url INTO v_terms, v_platinum FROM public.current_policy_pdf_urls();

  IF NEW.pdf_basic_url    IS NULL THEN NEW.pdf_basic_url    := v_platinum; END IF;
  IF NEW.pdf_gold_url     IS NULL THEN NEW.pdf_gold_url     := v_platinum; END IF;
  IF NEW.pdf_platinum_url IS NULL THEN NEW.pdf_platinum_url := v_platinum; END IF;
  IF NEW.pdf_document_path IS NULL THEN NEW.pdf_document_path := v_terms; END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_policy_pdf_urls ON public.customer_policies;
CREATE TRIGGER trg_populate_policy_pdf_urls
BEFORE INSERT OR UPDATE ON public.customer_policies
FOR EACH ROW EXECUTE FUNCTION public.populate_policy_pdf_urls();

-- Backfill every existing policy that has NULL PDF fields (covers Mohammad Iqbal AP70LXD and any historical gaps)
UPDATE public.customer_policies
SET
  pdf_basic_url    = COALESCE(pdf_basic_url,    (SELECT platinum_url FROM public.current_policy_pdf_urls())),
  pdf_gold_url     = COALESCE(pdf_gold_url,     (SELECT platinum_url FROM public.current_policy_pdf_urls())),
  pdf_platinum_url = COALESCE(pdf_platinum_url, (SELECT platinum_url FROM public.current_policy_pdf_urls())),
  pdf_document_path = COALESCE(pdf_document_path, (SELECT terms_url FROM public.current_policy_pdf_urls()))
WHERE pdf_basic_url IS NULL
   OR pdf_gold_url IS NULL
   OR pdf_platinum_url IS NULL
   OR pdf_document_path IS NULL;
