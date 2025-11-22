-- Insert the admin-only "99off" discount code for testing payments
INSERT INTO public.discount_codes (
  code,
  type,
  value,
  valid_from,
  valid_to,
  usage_limit,
  active,
  applicable_products
) VALUES (
  '99off',
  'percentage',
  99,
  NOW(),
  NOW() + INTERVAL '1 year',
  100,
  true,
  '["all"]'::jsonb
) ON CONFLICT (code) DO UPDATE SET
  value = 99,
  valid_from = NOW(),
  valid_to = NOW() + INTERVAL '1 year',
  usage_limit = 100,
  active = true;