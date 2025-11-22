-- Add missing add-on columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS mot_repair boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lost_key boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consequential boolean DEFAULT false;

-- Add missing add-on columns to customer_policies table  
ALTER TABLE public.customer_policies
ADD COLUMN IF NOT EXISTS mot_repair boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS lost_key boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS consequential boolean DEFAULT false;