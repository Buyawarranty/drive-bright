-- Create abandoned cart discount code (10% off, one use per customer)
INSERT INTO public.discount_codes (
  code,
  type,
  value,
  valid_from,
  valid_to,
  usage_limit,
  active,
  campaign_source,
  applicable_products
) VALUES (
  'COMEBACK10',
  'percentage',
  10,
  now(),
  now() + interval '10 years', -- Long validity for ongoing abandoned cart campaigns
  NULL, -- No total usage limit
  true,
  'abandoned_cart_campaign',
  '["all"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- The discount_code_usage table already tracks per-customer usage
-- The validate-discount-code function already prevents customers from using the same code twice
-- This ensures each customer can only use COMEBACK10 once