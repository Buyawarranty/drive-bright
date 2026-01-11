-- Add payment confirmation tracking columns to live_quotes table
ALTER TABLE public.live_quotes 
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID,
ADD COLUMN IF NOT EXISTS payment_source TEXT,
ADD COLUMN IF NOT EXISTS payment_reference TEXT;

-- Add index for faster lookups on status
CREATE INDEX IF NOT EXISTS idx_live_quotes_status ON public.live_quotes(status);

-- Add comment for documentation
COMMENT ON COLUMN public.live_quotes.payment_confirmed_at IS 'Timestamp when external payment was confirmed by admin';
COMMENT ON COLUMN public.live_quotes.payment_confirmed_by IS 'Admin user ID who confirmed the external payment';
COMMENT ON COLUMN public.live_quotes.payment_source IS 'Source of external payment (stripe_dashboard, bumper_portal, bank_transfer, etc.)';
COMMENT ON COLUMN public.live_quotes.payment_reference IS 'External payment reference or transaction ID';