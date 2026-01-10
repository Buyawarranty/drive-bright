-- Add is_manual_entry flag to customers table to distinguish paid vs manual entries
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT FALSE;

-- Add payment_verified flag to track verified payments
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;

-- Add is_manual_entry flag to customer_policies table
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS is_manual_entry BOOLEAN DEFAULT FALSE;

-- Add payment_verified flag to customer_policies table
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS payment_verified BOOLEAN DEFAULT FALSE;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_customers_is_manual_entry ON public.customers(is_manual_entry);
CREATE INDEX IF NOT EXISTS idx_customers_payment_verified ON public.customers(payment_verified);
CREATE INDEX IF NOT EXISTS idx_customer_policies_is_manual_entry ON public.customer_policies(is_manual_entry);

-- Update existing records: 
-- Records with stripe_session_id starting with 'manual_' or NULL stripe_session_id/bumper_order_id are manual entries
UPDATE public.customers 
SET is_manual_entry = TRUE,
    payment_verified = FALSE
WHERE (stripe_session_id IS NULL AND bumper_order_id IS NULL)
   OR stripe_session_id LIKE 'manual_%';

-- Records with valid stripe_session_id or bumper_order_id are payment verified
UPDATE public.customers 
SET is_manual_entry = FALSE,
    payment_verified = TRUE
WHERE (stripe_session_id IS NOT NULL AND stripe_session_id NOT LIKE 'manual_%')
   OR bumper_order_id IS NOT NULL;

-- Update customer_policies based on customer data
UPDATE public.customer_policies cp
SET is_manual_entry = c.is_manual_entry,
    payment_verified = c.payment_verified
FROM public.customers c
WHERE cp.customer_id = c.id;

-- Add comment for documentation
COMMENT ON COLUMN public.customers.is_manual_entry IS 'True if the warranty was created manually by admin (not through automated payment flow)';
COMMENT ON COLUMN public.customers.payment_verified IS 'True if payment was verified through Stripe or Bumper';
COMMENT ON COLUMN public.customer_policies.is_manual_entry IS 'True if the policy was created manually by admin';
COMMENT ON COLUMN public.customer_policies.payment_verified IS 'True if payment was verified through Stripe or Bumper';