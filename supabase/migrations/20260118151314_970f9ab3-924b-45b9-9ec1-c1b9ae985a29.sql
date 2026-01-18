-- Update customer_documents to point to the latest warranty documents
-- The newest files are Platinum-Warranty-Plan-v2.4.pdf and the latest Terms in the public folder

-- Update all platinum/premium/gold/basic plan documents to use v2.4
UPDATE customer_documents 
SET 
  file_url = 'https://drive-bright.lovable.app/Platinum-Warranty-Plan-v2.4.pdf',
  document_name = 'Platinum Warranty Plan 2.4',
  updated_at = now()
WHERE plan_type IN ('platinum', 'premium', 'gold', 'basic')
  AND vehicle_type = 'standard';

-- Update terms and conditions to use the latest version
UPDATE customer_documents 
SET 
  file_url = 'https://drive-bright.lovable.app/Terms-and-Conditions-v2.3.pdf',
  document_name = 'Terms and Conditions v2.3',
  updated_at = now()
WHERE plan_type = 'terms-and-conditions'
  AND vehicle_type = 'standard';