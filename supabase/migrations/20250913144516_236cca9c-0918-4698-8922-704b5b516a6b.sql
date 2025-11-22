-- Add missing add-on columns to customer_policies table
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS breakdown_recovery BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicle_rental BOOLEAN DEFAULT false;

-- Also add missing add-on columns to customers table if they don't exist
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS tyre_cover BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wear_tear BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS europe_cover BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS transfer_cover BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS breakdown_recovery BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vehicle_rental BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mot_fee BOOLEAN DEFAULT false;