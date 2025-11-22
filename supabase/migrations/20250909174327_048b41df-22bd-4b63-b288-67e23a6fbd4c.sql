-- Add new coverage fields to customer_policies table
ALTER TABLE public.customer_policies 
ADD COLUMN mot_fee BOOLEAN DEFAULT false,
ADD COLUMN tyre_cover BOOLEAN DEFAULT false,
ADD COLUMN wear_tear BOOLEAN DEFAULT false,
ADD COLUMN europe_cover BOOLEAN DEFAULT false,
ADD COLUMN transfer_cover BOOLEAN DEFAULT false;

-- Add comment to document the new fields
COMMENT ON COLUMN public.customer_policies.mot_fee IS 'MOT fee coverage included in policy';
COMMENT ON COLUMN public.customer_policies.tyre_cover IS 'Tyre replacement coverage included in policy';
COMMENT ON COLUMN public.customer_policies.wear_tear IS 'Wear and tear coverage included in policy';
COMMENT ON COLUMN public.customer_policies.europe_cover IS 'European breakdown coverage included in policy';
COMMENT ON COLUMN public.customer_policies.transfer_cover IS 'Policy transfer coverage included in policy';