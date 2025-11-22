-- Create the SAVE25NOW discount code
INSERT INTO discount_codes (
  code,
  type,
  value,
  valid_from,
  valid_to,
  usage_limit,
  active,
  applicable_products
) VALUES (
  'SAVE25NOW',
  'fixed',
  25.00,
  NOW(),
  NOW() + INTERVAL '1 year',
  NULL, -- unlimited usage
  true,
  '["all"]'::jsonb
) ON CONFLICT (code) DO NOTHING;