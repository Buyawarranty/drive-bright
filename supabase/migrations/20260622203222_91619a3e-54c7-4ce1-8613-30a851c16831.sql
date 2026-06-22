
ALTER TABLE public.claims_submissions
  ADD COLUMN IF NOT EXISTS policy_id uuid REFERENCES public.customer_policies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_claims_submissions_policy_id ON public.claims_submissions(policy_id);
CREATE INDEX IF NOT EXISTS idx_claims_submissions_email_reg ON public.claims_submissions(lower(email), upper(replace(vehicle_registration,' ','')));

-- Allow logged-in customers to read their own claims (matched by their auth email)
DROP POLICY IF EXISTS "Customers can view their own claims" ON public.claims_submissions;
CREATE POLICY "Customers can view their own claims"
  ON public.claims_submissions
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower((auth.jwt() ->> 'email')));
