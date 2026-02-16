
-- Add payment collection due date to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Add index for filtering by payment due date
CREATE INDEX IF NOT EXISTS idx_customers_payment_due_date ON public.customers(payment_due_date) WHERE payment_due_date IS NOT NULL;
