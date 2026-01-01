-- Add payment tracking columns to sales_leads table
ALTER TABLE public.sales_leads
ADD COLUMN IF NOT EXISTS is_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS step_two_completed_at timestamp with time zone DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.sales_leads.is_paid IS 'Whether this lead has completed a purchase';
COMMENT ON COLUMN public.sales_leads.payment_amount IS 'The amount paid by the customer';
COMMENT ON COLUMN public.sales_leads.payment_method IS 'Payment method used (stripe, bumper, etc.)';
COMMENT ON COLUMN public.sales_leads.payment_date IS 'Timestamp when payment was completed';
COMMENT ON COLUMN public.sales_leads.step_two_completed_at IS 'Timestamp when customer completed step 2 (quote delivery)';