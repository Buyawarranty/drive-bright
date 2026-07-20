
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_comparison_proof_url text;

-- Storage policies: authenticated staff manage files in the price-comparison-proofs bucket
DROP POLICY IF EXISTS "Staff can view price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can view price comparison proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs');

DROP POLICY IF EXISTS "Staff can upload price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can upload price comparison proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'price-comparison-proofs');

DROP POLICY IF EXISTS "Staff can update price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can update price comparison proofs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs');

DROP POLICY IF EXISTS "Staff can delete price comparison proofs" ON storage.objects;
CREATE POLICY "Staff can delete price comparison proofs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'price-comparison-proofs');
