-- Add claim_limit column to bumper_transactions table
ALTER TABLE public.bumper_transactions 
ADD COLUMN claim_limit INTEGER DEFAULT 1250;