-- Revert to correct single .pdf extension now that file is re-uploaded correctly
UPDATE customer_documents
SET file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.1-2026-02.pdf',
    updated_at = now()
WHERE file_url LIKE '%platinum-warranty-plan-v3.1-2026-02.pdf%';

UPDATE plan_document_mapping
SET document_path = 'platinum/platinum-warranty-plan-v3.1-2026-02.pdf',
    updated_at = now()
WHERE document_path LIKE '%platinum-warranty-plan-v3.1-2026-02%';