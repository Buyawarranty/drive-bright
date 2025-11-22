-- Fix voluntary_excess default value in customer_policies table
-- Change from 150 to NULL so we can properly handle 0 values
ALTER TABLE customer_policies 
ALTER COLUMN voluntary_excess SET DEFAULT NULL;

-- Fix voluntary_excess default value in customers table
ALTER TABLE customers 
ALTER COLUMN voluntary_excess SET DEFAULT NULL;

-- Add comment to document the proper handling
COMMENT ON COLUMN customer_policies.voluntary_excess IS 'Voluntary excess amount. NULL means not set, 0 means zero excess selected by customer, any positive number is the excess amount.';