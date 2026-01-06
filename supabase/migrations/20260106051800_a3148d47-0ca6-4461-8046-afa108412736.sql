-- Update all plan types to use the Platinum Warranty Plan v2.3 as the standard document
-- Insert or update records to ensure v2.3 is the most recent for all car plan types

-- Update basic plan to use v2.3
INSERT INTO customer_documents (
  plan_type,
  vehicle_type,
  document_name,
  file_url,
  file_size
)
VALUES (
  'basic',
  'standard',
  'Platinum Warranty Plan 2.3',
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf',
  0
)
ON CONFLICT DO NOTHING;

-- Update gold plan to use v2.3
INSERT INTO customer_documents (
  plan_type,
  vehicle_type,
  document_name,
  file_url,
  file_size
)
VALUES (
  'gold',
  'standard',
  'Platinum Warranty Plan 2.3',
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf',
  0
)
ON CONFLICT DO NOTHING;