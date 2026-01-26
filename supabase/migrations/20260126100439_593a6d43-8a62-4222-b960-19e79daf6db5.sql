-- Update customer mickycowen@icloud.com with labour rate £100/hr and claim limit £3500
UPDATE customers 
SET claim_limit = 3500, labour_rate = 100, updated_at = now()
WHERE email = 'mickycowen@icloud.com';

UPDATE customer_policies 
SET claim_limit = 3500, updated_at = now()
WHERE email = 'mickycowen@icloud.com';