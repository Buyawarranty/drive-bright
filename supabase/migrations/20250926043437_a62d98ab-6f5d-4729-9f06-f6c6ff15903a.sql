-- Update customer DV67 YFW's voluntary excess to correct value and re-send to Warranties 2000
UPDATE customers 
SET voluntary_excess = 150
WHERE registration_plate = 'DV67 YFW';

-- Also add voluntary_excess column to customer_policies table for consistency
ALTER TABLE customer_policies 
ADD COLUMN IF NOT EXISTS voluntary_excess NUMERIC DEFAULT 150;