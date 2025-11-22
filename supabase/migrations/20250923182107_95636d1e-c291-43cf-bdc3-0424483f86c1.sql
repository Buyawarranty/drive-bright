-- Drop the existing check constraint
ALTER TABLE customer_documents DROP CONSTRAINT customer_documents_plan_type_check;

-- Add the new constraint that includes 'premium'
ALTER TABLE customer_documents ADD CONSTRAINT customer_documents_plan_type_check 
CHECK (plan_type = ANY (ARRAY['basic'::text, 'gold'::text, 'platinum'::text, 'premium'::text, 'special-vehicle'::text, 'terms-and-conditions'::text, 'electric'::text, 'motorbike'::text, 'phev'::text]));

-- Insert premium plan document using the existing Platinum PDF as the standard
INSERT INTO customer_documents (
  plan_type,
  document_name,
  file_url,
  vehicle_type
) VALUES (
  'premium',
  'Premium Extended Warranty Plan 2.0',
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Extended-Warranty%202.0-1754464769023.pdf',
  'standard'
);

-- Update all existing customer policies to use premium plan for standard warranties
UPDATE customer_policies 
SET plan_type = 'Premium Car Plan'
WHERE plan_type IN ('Basic', 'Gold', 'Platinum', 'basic', 'gold', 'platinum', 'Basic Car Plan', 'Gold Car Plan', 'Platinum Car Plan');