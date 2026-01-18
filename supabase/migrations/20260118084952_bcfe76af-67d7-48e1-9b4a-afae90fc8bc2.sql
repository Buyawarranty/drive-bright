-- Update trustpilot_review_emails table to support 3-email sequence
ALTER TABLE public.trustpilot_review_emails 
ADD COLUMN IF NOT EXISTS email_sequence_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS email_opened BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS email_clicked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS next_email_scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_subject TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_trustpilot_review_next_scheduled 
ON public.trustpilot_review_emails(next_email_scheduled_for) 
WHERE review_completed = FALSE;

-- Add comment for documentation
COMMENT ON TABLE public.trustpilot_review_emails IS 'Tracks 3-email Trustpilot review request sequence. Email 1 sent 3-7 days after purchase, Email 2 sent 5-7 days after Email 1, Email 3 sent 7-10 days after Email 2. Stops if review_completed = true.';