-- Add last_login timestamp to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_last_login ON customers(last_login DESC);

-- Add last_login to customer_policies for tracking
ALTER TABLE customer_policies ADD COLUMN IF NOT EXISTS last_login timestamp with time zone;