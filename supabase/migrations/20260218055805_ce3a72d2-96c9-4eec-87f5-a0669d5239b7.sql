-- Fix Platinum PDF reference to match actual uploaded filename (.pdf.pdf)
UPDATE customer_documents
SET file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.1-2026-02.pdf.pdf',
    updated_at = now()
WHERE file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.1-2026-02.pdf';

UPDATE plan_document_mapping
SET document_path = 'platinum/platinum-warranty-plan-v3.1-2026-02.pdf.pdf',
    updated_at = now()
WHERE document_path = 'platinum/platinum-warranty-plan-v3.1-2026-02.pdf';