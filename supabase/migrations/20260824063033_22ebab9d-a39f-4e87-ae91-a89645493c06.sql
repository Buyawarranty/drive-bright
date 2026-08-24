CREATE TABLE public.claim_inspection_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  customer_name text,
  customer_email text NOT NULL,
  customer_phone text,
  vehicle_registration text,
  claim_reason text,
  inspection_company text NOT NULL DEFAULT 'ACE',
  fee_amount numeric NOT NULL DEFAULT 140,
  status text NOT NULL DEFAULT 'sent',
  garage_name text,
  garage_contact text,
  garage_phone text,
  garage_address text,
  vehicle_location text,
  current_mileage integer,
  availability_notes text,
  additional_notes text,
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_at timestamptz,
  submitted_at timestamptz,
  stripe_session_id text,
  amount_paid numeric,
  paid_at timestamptz,
  created_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_inspection_requests TO authenticated;
GRANT ALL ON public.claim_inspection_requests TO service_role;

ALTER TABLE public.claim_inspection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inspection requests"
ON public.claim_inspection_requests FOR SELECT TO authenticated
USING (public.is_admin_or_sales((select auth.uid())));

CREATE POLICY "Staff can create inspection requests"
ON public.claim_inspection_requests FOR INSERT TO authenticated
WITH CHECK (public.is_admin_or_sales((select auth.uid())));

CREATE POLICY "Staff can update inspection requests"
ON public.claim_inspection_requests FOR UPDATE TO authenticated
USING (public.is_admin_or_sales((select auth.uid())));

CREATE POLICY "Staff can delete inspection requests"
ON public.claim_inspection_requests FOR DELETE TO authenticated
USING (public.is_admin_or_sales((select auth.uid())));

CREATE INDEX idx_claim_inspection_requests_claim ON public.claim_inspection_requests(claim_id);
CREATE INDEX idx_claim_inspection_requests_token ON public.claim_inspection_requests(token);

CREATE TRIGGER update_claim_inspection_requests_updated_at
BEFORE UPDATE ON public.claim_inspection_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();