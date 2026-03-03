
-- Add resubmission tracking to sales_leads
ALTER TABLE public.sales_leads 
  ADD COLUMN IF NOT EXISTS resubmission_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_resubmitted_at timestamptz DEFAULT NULL;
