-- Upload the new PDF files to the policy-documents storage bucket
-- This ensures the email functions can access them

-- Note: The files are already copied to the public folder
-- We need to make sure they're also available in the storage bucket

INSERT INTO storage.objects (bucket_id, name, owner, metadata, path_tokens)
VALUES 
  ('policy-documents', 'Terms-and-Conditions-Your-Extended-Warranty-Guide-v2.2-4.pdf', NULL, '{"size": 0, "mimetype": "application/pdf"}', ARRAY['Terms-and-Conditions-Your-Extended-Warranty-Guide-v2.2-4.pdf']),
  ('policy-documents', 'Platinum-warranty-plan_v2.2-3.pdf', NULL, '{"size": 0, "mimetype": "application/pdf"}', ARRAY['Platinum-warranty-plan_v2.2-3.pdf'])
ON CONFLICT (bucket_id, name) DO NOTHING;