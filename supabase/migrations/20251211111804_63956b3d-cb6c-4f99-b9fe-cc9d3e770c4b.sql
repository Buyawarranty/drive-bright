-- Add policy_start_date column if not exists and warranty_2000_scheduled flag
ALTER TABLE public.customer_policies 
ADD COLUMN IF NOT EXISTS warranties_2000_scheduled_for timestamp with time zone;

-- Add index for efficient querying of scheduled submissions
CREATE INDEX IF NOT EXISTS idx_customer_policies_w2000_scheduled 
ON public.customer_policies (warranties_2000_scheduled_for) 
WHERE warranties_2000_status = 'scheduled';

-- Update existing policies to mark as 'sent' if already sent, otherwise 'not_sent'
COMMENT ON COLUMN public.customer_policies.warranties_2000_scheduled_for IS 'Date when warranty data should be sent to W2000 API';