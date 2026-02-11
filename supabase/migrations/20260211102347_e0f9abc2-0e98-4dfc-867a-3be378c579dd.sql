-- Add unique constraint on warranty_number to prevent duplicates
-- First remove any existing duplicates by keeping the most recent one
DELETE FROM customer_policies a
USING customer_policies b
WHERE a.warranty_number IS NOT NULL 
  AND a.warranty_number = b.warranty_number 
  AND a.id < b.id;

-- Now add the unique constraint
ALTER TABLE customer_policies
ADD CONSTRAINT customer_policies_warranty_number_unique UNIQUE (warranty_number);