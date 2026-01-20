-- Update seasonal_bonus_months for the customer
UPDATE customers 
SET seasonal_bonus_months = 6, updated_at = now()
WHERE id = '2176d1b7-b273-4055-a67e-6cab73379eca';

-- Update seasonal_bonus_months for the customer policy
UPDATE customer_policies 
SET seasonal_bonus_months = 6, updated_at = now()
WHERE id = '0a0bba7c-6d42-4a2a-b7da-acc0b19b26ee';