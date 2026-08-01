ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deposit_taken boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS balance_due_amount numeric,
  ADD COLUMN IF NOT EXISTS deposit_taken_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_taken_by uuid;

CREATE INDEX IF NOT EXISTS idx_customers_deposit_taken
  ON public.customers (deposit_taken)
  WHERE deposit_taken = true;