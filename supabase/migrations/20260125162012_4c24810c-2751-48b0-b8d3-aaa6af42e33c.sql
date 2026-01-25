-- Add sales agent attribution columns to customers table
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS quote_sent_by UUID REFERENCES admin_users(id),
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID REFERENCES admin_users(id);

-- Add sales agent attribution columns to customer_policies table  
ALTER TABLE customer_policies
ADD COLUMN IF NOT EXISTS quote_sent_by UUID,
ADD COLUMN IF NOT EXISTS payment_confirmed_by UUID;

-- Add comments for clarity
COMMENT ON COLUMN customers.quote_sent_by IS 'Admin user who sent the original quote/payment link';
COMMENT ON COLUMN customers.payment_confirmed_by IS 'Admin user who confirmed the external payment';
COMMENT ON COLUMN customer_policies.quote_sent_by IS 'Admin user who sent the original quote/payment link';
COMMENT ON COLUMN customer_policies.payment_confirmed_by IS 'Admin user who confirmed the external payment';