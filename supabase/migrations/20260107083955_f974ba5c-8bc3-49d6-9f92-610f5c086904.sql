-- Add review tracking columns to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS trustpilot_review_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trustpilot_review_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trustpilot_review_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS trustpilot_review_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS google_review_requested BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_review_requested_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS google_review_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS google_review_completed_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_customers_trustpilot_review ON public.customers(trustpilot_review_completed);
CREATE INDEX IF NOT EXISTS idx_customers_google_review ON public.customers(google_review_completed);