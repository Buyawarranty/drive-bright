-- Tighten storage policies flagged by the security scanner (2026-09-21)
-- 1) policy-documents: only admins may overwrite/delete warranty PDFs
-- 2) price-comparison-proofs: only staff may view/upload/modify proofs

-- policy-documents
DROP POLICY IF EXISTS "Admins can update policy documents" ON storage.objects;
CREATE POLICY "Admins can update policy documents"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'policy-documents' AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete policy documents" ON storage.objects;
CREATE POLICY "Admins can delete policy documents"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'policy-documents' AND public.is_admin(auth.uid()));

-- price-comparison-proofs
DROP POLICY IF EXISTS "Staff can view price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can view price comparison proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs' AND public.is_staff());

DROP POLICY IF EXISTS "Staff can upload price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can upload price comparison proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'price-comparison-proofs' AND public.is_staff());

DROP POLICY IF EXISTS "Staff can update price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can update price comparison proofs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs' AND public.is_staff());

DROP POLICY IF EXISTS "Staff can delete price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can delete price comparison proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs' AND public.is_staff());