-- Create warranty for Sarabsingh@live.co.uk with proper user linkage
INSERT INTO customer_policies (
  customer_id,
  user_id,
  email,
  customer_full_name,
  plan_type,
  payment_type,
  policy_number,
  warranty_number,
  policy_start_date,
  policy_end_date,
  payment_amount,
  claim_limit,
  voluntary_excess,
  breakdown_recovery,
  mot_fee,
  vehicle_rental,
  address,
  status,
  email_sent_status,
  warranties_2000_status,
  created_at,
  updated_at
)
SELECT
  c.id,
  '054c6d0f-8025-45f4-afc0-f639ee058694'::uuid,  -- Link to auth user
  'sarabsingh@live.co.uk',
  'Mr Sarab Singh',
  'Platinum',
  '24months',
  'POL-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0'),
  generate_warranty_number(),
  '2025-10-02'::timestamp with time zone,
  '2027-10-02'::timestamp with time zone,
  1.00,
  2000,
  150,
  true,  -- 24/7 Recovery
  true,  -- MOT Fee
  false,
  jsonb_build_object(
    'registration', 'LR60 FWM',
    'make', 'Audi',
    'model', 'Q5',
    'year', '2010',
    'mileage', '109000',
    'engineSize', '1968',
    'address_line1', '74 Blackboy Road',
    'postcode', 'EX4 6TB',
    'purchasePrice', '1.00',
    'purchaseDate', '2025-10-02'
  ),
  'active',
  'not_sent',
  'not_sent',
  now(),
  now()
FROM customers c
WHERE c.email = 'sarabsingh@live.co.uk';