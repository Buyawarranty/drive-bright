-- Add claim_limit field to customer_policies table to store the claim limit values (750, 1250, 2000)
ALTER TABLE public.customer_policies 
ADD COLUMN claim_limit integer DEFAULT 1250;

-- Add claim_limit field to customers table as well for consistency
ALTER TABLE public.customers 
ADD COLUMN claim_limit integer DEFAULT 1250;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_customer_policies_claim_limit ON public.customer_policies(claim_limit);
CREATE INDEX IF NOT EXISTS idx_customers_claim_limit ON public.customers(claim_limit);