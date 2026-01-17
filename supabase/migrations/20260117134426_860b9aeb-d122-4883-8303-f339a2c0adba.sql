-- Add purchase_source column to track how customers purchased their warranty
-- Values: 'website' (direct website purchase), 'quote_link' (via admin quote), 'external' (external payment confirmed by admin)
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS purchase_source TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN public.customers.purchase_source IS 'How the customer purchased: website (direct), quote_link (via admin quote), external (manual confirmation)';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_customers_purchase_source ON public.customers(purchase_source);

-- Update existing records based on current data patterns
-- External payments: is_manual_entry = true
UPDATE public.customers 
SET purchase_source = 'external'
WHERE is_manual_entry = true AND purchase_source IS NULL;

-- Website direct: has stripe_session_id starting with cs_ or bumper_order_id, and NOT manual entry
UPDATE public.customers 
SET purchase_source = 'website'
WHERE is_manual_entry = false 
  AND (stripe_session_id LIKE 'cs_%' OR bumper_order_id IS NOT NULL)
  AND purchase_source IS NULL;

-- Default remaining to website (historical records)
UPDATE public.customers 
SET purchase_source = 'website'
WHERE purchase_source IS NULL;