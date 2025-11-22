-- Fix the relationship issue between customers and customer_policies tables
-- The problem is that customer_policies.email should link to customers.email
-- or we need to add a customer_id field to customer_policies table

-- First, let's add a customer_id field to customer_policies table to create proper relationship
ALTER TABLE public.customer_policies 
ADD COLUMN customer_id UUID;

-- Create an index for better performance
CREATE INDEX idx_customer_policies_customer_id ON public.customer_policies(customer_id);

-- Add foreign key constraint
ALTER TABLE public.customer_policies 
ADD CONSTRAINT fk_customer_policies_customer_id 
FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

-- Update existing records to link customer_policies to customers by email
UPDATE public.customer_policies 
SET customer_id = customers.id 
FROM public.customers 
WHERE public.customer_policies.email = customers.email 
AND public.customer_policies.customer_id IS NULL;