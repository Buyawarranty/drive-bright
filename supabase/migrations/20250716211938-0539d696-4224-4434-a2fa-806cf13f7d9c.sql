-- Create a test customer policy that can be used with a manually created user
INSERT INTO public.customer_policies (
  email,
  plan_type,
  payment_type,
  policy_number,
  policy_start_date,
  policy_end_date,
  status
) VALUES (
  'customer2@test.com',
  'basic',
  'monthly',
  'POL-TEST-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-0002',
  NOW(),
  NOW() + INTERVAL '1 year',
  'active'
);