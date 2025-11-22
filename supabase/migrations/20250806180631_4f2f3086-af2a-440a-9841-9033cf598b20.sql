-- Check current check constraint on customer_documents table
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.customer_documents'::regclass 
AND contype = 'c';

-- Update the check constraint to allow 'terms-and-conditions' as a valid plan_type
ALTER TABLE public.customer_documents 
DROP CONSTRAINT IF EXISTS customer_documents_plan_type_check;

ALTER TABLE public.customer_documents 
ADD CONSTRAINT customer_documents_plan_type_check 
CHECK (plan_type IN ('basic', 'gold', 'platinum', 'special-vehicle', 'terms-and-conditions'));