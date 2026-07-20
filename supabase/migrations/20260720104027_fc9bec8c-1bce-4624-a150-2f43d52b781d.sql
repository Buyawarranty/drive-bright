ALTER TABLE public.customers 
  ADD COLUMN IF NOT EXISTS payment_collected_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_collected_by uuid,
  ADD COLUMN IF NOT EXISTS payment_collection_note text;

CREATE INDEX IF NOT EXISTS idx_customers_payment_due_date ON public.customers(payment_due_date) WHERE payment_due_date IS NOT NULL;