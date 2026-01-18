-- Update all warranty plan documents to use Supabase storage bucket URLs
-- Platinum warranty (used for platinum, premium, gold, basic plans)
UPDATE customer_documents
SET 
  file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf',
  document_name = 'Platinum Warranty Plan v2.3',
  updated_at = now()
WHERE plan_type IN ('platinum', 'premium', 'gold', 'basic')
  AND vehicle_type = 'standard';

-- Update terms and conditions to use Supabase storage bucket
UPDATE customer_documents
SET 
  file_url = 'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/terms/Terms-and-Conditions-v2.3.pdf',
  document_name = 'Terms and Conditions v2.3',
  updated_at = now()
WHERE plan_type = 'terms-and-conditions'
  AND vehicle_type = 'standard';