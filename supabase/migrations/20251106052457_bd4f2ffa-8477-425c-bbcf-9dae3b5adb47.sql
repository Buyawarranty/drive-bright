-- Add field to track seasonal bonus months in customer_policies
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS seasonal_bonus_months INTEGER DEFAULT 0;

COMMENT ON COLUMN public.customer_policies.seasonal_bonus_months IS 'Extra months of free warranty coverage from seasonal promotions (e.g., 3 months free bonus)';

-- Add field to customers table as well for consistency
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS seasonal_bonus_months INTEGER DEFAULT 0;

COMMENT ON COLUMN public.customers.seasonal_bonus_months IS 'Extra months of free warranty coverage from seasonal promotions (e.g., 3 months free bonus)';