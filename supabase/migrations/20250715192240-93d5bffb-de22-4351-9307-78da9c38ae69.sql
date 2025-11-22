-- Drop the existing plan_type check constraint
ALTER TABLE customer_documents DROP CONSTRAINT customer_documents_plan_type_check;

-- Add a new constraint that includes all the plan types
ALTER TABLE customer_documents ADD CONSTRAINT customer_documents_plan_type_check 
CHECK (plan_type = ANY (ARRAY['basic'::text, 'gold'::text, 'platinum'::text, 'electric'::text, 'motorbike'::text, 'phev'::text]));