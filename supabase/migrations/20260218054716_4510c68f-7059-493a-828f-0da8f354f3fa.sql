
-- =============================================
-- PDF v2.3 → v3.1 MIGRATION
-- Updates all customer_documents and plan_document_mapping
-- =============================================

-- 1. Update ALL Platinum/Basic/Gold/Premium plan document rows to v3.1
UPDATE customer_documents
SET 
  document_name = 'Platinum Warranty Plan v3.1',
  file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/platinum-warranty-plan-v3.1-2026-02.pdf',
  updated_at = now()
WHERE file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf';

-- 2. Update ALL Terms and Conditions rows to v3.1
UPDATE customer_documents
SET 
  document_name = 'Terms and Conditions v3.1',
  file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/terms-and-conditions-v3.1-2026-02.pdf',
  updated_at = now()
WHERE file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/Terms-and-Conditions-v2.3.pdf';

-- 3. Update plan_document_mapping for Platinum standard vehicle type
UPDATE plan_document_mapping
SET 
  document_path = 'platinum/platinum-warranty-plan-v3.1-2026-02.pdf',
  updated_at = now()
WHERE plan_name = 'Platinum' AND vehicle_type = 'standard';
