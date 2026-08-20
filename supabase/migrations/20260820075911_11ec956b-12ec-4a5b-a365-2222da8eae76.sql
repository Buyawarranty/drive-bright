ALTER TABLE public.agent_review_claims
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registration_plate text;

CREATE INDEX IF NOT EXISTS idx_agent_review_claims_customer_id ON public.agent_review_claims(customer_id);