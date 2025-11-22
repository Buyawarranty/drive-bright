-- Update the check constraint to include all existing plan_type values plus terms-and-conditions
ALTER TABLE public.customer_documents 
DROP CONSTRAINT IF EXISTS customer_documents_plan_type_check;

ALTER TABLE public.customer_documents 
ADD CONSTRAINT customer_documents_plan_type_check 
CHECK (plan_type IN ('basic', 'gold', 'platinum', 'special-vehicle', 'terms-and-conditions', 'electric', 'motorbike', 'phev'));