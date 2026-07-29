CREATE OR REPLACE FUNCTION public.current_policy_pdf_urls()
RETURNS TABLE(terms_url text, platinum_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE((SELECT file_url FROM public.customer_documents WHERE plan_type = 'terms-and-conditions' ORDER BY created_at DESC LIMIT 1),
      'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf')::text,
    COALESCE((SELECT file_url FROM public.customer_documents WHERE plan_type = 'platinum' ORDER BY created_at DESC LIMIT 1),
      'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf')::text
$$;