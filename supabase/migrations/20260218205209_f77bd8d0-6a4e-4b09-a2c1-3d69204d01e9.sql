-- Fix Melanie Hinds customer amount: £33 (monthly) → £396 (total Bumper amount)
UPDATE customers SET final_amount = 396 WHERE id = 'ddacba98-f074-4027-be8c-edd3dc0fe005';
UPDATE customer_policies SET payment_amount = 396 WHERE id = '50289a5e-b086-48c0-b547-f71a73fb48e8';