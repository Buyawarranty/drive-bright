CREATE TABLE public.claim_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  vehicle_registration text,
  invoice_name text,
  amount numeric,
  invoice_date date,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_type text,
  uploaded_by uuid,
  uploaded_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_invoices TO authenticated;
GRANT ALL ON public.claim_invoices TO service_role;

ALTER TABLE public.claim_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage claim invoices"
ON public.claim_invoices FOR ALL TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE INDEX idx_claim_invoices_claim_id ON public.claim_invoices(claim_id);
CREATE INDEX idx_claim_invoices_date ON public.claim_invoices(invoice_date DESC);

CREATE TRIGGER update_claim_invoices_updated_at
BEFORE UPDATE ON public.claim_invoices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();