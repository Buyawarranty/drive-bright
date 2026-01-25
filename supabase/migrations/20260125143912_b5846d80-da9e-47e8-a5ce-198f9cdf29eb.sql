-- Fix the status constraint to include 'scheduled' status for future-dated policies
ALTER TABLE customer_policies DROP CONSTRAINT IF EXISTS customer_policies_status_check;
ALTER TABLE customer_policies ADD CONSTRAINT customer_policies_status_check 
  CHECK (status = ANY (ARRAY['active'::text, 'cancelled'::text, 'expired'::text, 'scheduled'::text]));