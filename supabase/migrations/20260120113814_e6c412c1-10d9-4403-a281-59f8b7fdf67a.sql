-- Add additional_notes column to customer_policies table
ALTER TABLE public.customer_policies
ADD COLUMN IF NOT EXISTS additional_notes text;