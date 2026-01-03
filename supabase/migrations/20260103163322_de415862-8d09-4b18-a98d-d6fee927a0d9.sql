-- Add manual upgrade tracking fields to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS manual_upgrade_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS manual_upgrade_by uuid,
ADD COLUMN IF NOT EXISTS manual_upgrade_notes text;

-- Add manual upgrade tracking fields to customer_policies table
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS manual_upgrade_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS manual_upgrade_by uuid,
ADD COLUMN IF NOT EXISTS manual_upgrade_notes text;

-- Create an index for quickly finding manually upgraded customers
CREATE INDEX IF NOT EXISTS idx_customers_manual_upgrade ON public.customers(manual_upgrade_at) WHERE manual_upgrade_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_policies_manual_upgrade ON public.customer_policies(manual_upgrade_at) WHERE manual_upgrade_at IS NOT NULL;