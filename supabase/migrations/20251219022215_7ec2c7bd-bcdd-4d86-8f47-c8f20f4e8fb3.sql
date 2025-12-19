-- Add GCLID column to bumper_transactions for server-side conversion tracking
ALTER TABLE public.bumper_transactions 
ADD COLUMN IF NOT EXISTS gclid TEXT,
ADD COLUMN IF NOT EXISTS client_id TEXT,
ADD COLUMN IF NOT EXISTS conversion_fired_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS conversion_status TEXT DEFAULT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN public.bumper_transactions.gclid IS 'Google Click ID for offline conversion tracking';
COMMENT ON COLUMN public.bumper_transactions.client_id IS 'GA4 Client ID for measurement protocol';
COMMENT ON COLUMN public.bumper_transactions.conversion_fired_at IS 'When server-side conversion was fired';
COMMENT ON COLUMN public.bumper_transactions.conversion_status IS 'Status of server-side conversion: pending, sent, failed';