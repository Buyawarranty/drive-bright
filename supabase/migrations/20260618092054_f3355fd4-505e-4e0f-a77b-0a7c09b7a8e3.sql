ALTER TABLE public.customer_policies
  ADD COLUMN IF NOT EXISTS retention_worked_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS retention_outcome TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_policies_policy_end_date
  ON public.customer_policies (policy_end_date);

CREATE INDEX IF NOT EXISTS idx_customer_policies_retention_worked_at
  ON public.customer_policies (retention_worked_at);