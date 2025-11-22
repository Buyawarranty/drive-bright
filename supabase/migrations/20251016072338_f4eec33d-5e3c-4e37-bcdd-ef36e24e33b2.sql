-- Update the Platinum warranty document to point to the new file
-- Insert new document records for valid plan types
INSERT INTO customer_documents (
  plan_type,
  vehicle_type,
  document_name,
  file_url,
  file_size
)
VALUES (
  'platinum',
  'standard',
  'Platinum Warranty Plan 2.3',
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf',
  0
)
ON CONFLICT DO NOTHING;

-- Also for premium plan
INSERT INTO customer_documents (
  plan_type,
  vehicle_type,
  document_name,
  file_url,
  file_size
)
VALUES (
  'premium',
  'standard',
  'Platinum Warranty Plan 2.3',
  'https://mzlpuxzwyrcyrgrongeb.supabase.co/storage/v1/object/public/policy-documents/platinum/Platinum-Warranty-Plan-v2.3.pdf',
  0
)
ON CONFLICT DO NOTHING;