-- Add conversion tracking to abandoned carts
ALTER TABLE abandoned_carts 
ADD COLUMN IF NOT EXISTS is_converted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_is_converted 
ON abandoned_carts(is_converted, created_at);

-- Add index for email and conversion status lookups
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email_converted 
ON abandoned_carts(email, is_converted);