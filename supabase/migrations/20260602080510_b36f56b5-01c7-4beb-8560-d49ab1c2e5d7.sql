UPDATE public.customer_documents
SET file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.4-2026-06-02.pdf',
    updated_at = now()
WHERE id = '4099b4d4-ef9e-43b5-b527-f6733322836e';

UPDATE public.customer_documents
SET file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.4-2026-06-02.pdf',
    updated_at = now()
WHERE id = 'aa5fc48c-90ea-4450-ad43-d9d802834069';