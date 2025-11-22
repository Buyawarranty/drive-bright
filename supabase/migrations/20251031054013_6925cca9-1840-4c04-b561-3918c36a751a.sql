-- Add cart_id column to triggered_emails_log to track individual carts
ALTER TABLE triggered_emails_log 
ADD COLUMN IF NOT EXISTS cart_id UUID REFERENCES abandoned_carts(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_triggered_emails_log_cart_id 
ON triggered_emails_log(cart_id);

-- Update the unique constraint to include cart_id instead of just email+trigger_type
-- This allows same email to receive multiple emails for different abandoned carts
ALTER TABLE triggered_emails_log 
DROP CONSTRAINT IF EXISTS triggered_emails_log_email_trigger_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_triggered_emails_log_cart_trigger 
ON triggered_emails_log(cart_id, trigger_type) 
WHERE cart_id IS NOT NULL;