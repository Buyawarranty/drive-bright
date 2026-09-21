DROP POLICY IF EXISTS "Allow uploads to policy documents bucket" ON storage.objects;
CREATE POLICY "Allow uploads to policy documents bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'policy-documents' AND public.is_staff());