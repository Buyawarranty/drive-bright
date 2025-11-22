-- Create customer record for the existing Bumper policy
INSERT INTO customers (
  name, 
  email, 
  plan_type, 
  status, 
  registration_plate,
  created_at,
  updated_at
) VALUES (
  'Kamran Qureshi',
  'buyawarranty1@gmail.com',
  'Basic',
  'Active',
  'B11CSD',
  '2025-08-05 19:56:44.794106+00',
  '2025-08-05 19:56:44.794106+00'
);

-- Get the created customer ID and update the policy record
UPDATE customer_policies 
SET customer_id = (
  SELECT id FROM customers WHERE email = 'buyawarranty1@gmail.com'
)
WHERE email = 'buyawarranty1@gmail.com' AND customer_id IS NULL;