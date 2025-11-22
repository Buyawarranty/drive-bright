-- Create renewal discount code (20% off, one use per customer)
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
  'RENEWAL20',
  'percentage',
  20,
  now(),
  now() + interval '10 years', -- Long validity for ongoing renewals
  NULL, -- No total usage limit
  true,
  'renewal_campaign',
  '["all"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- The discount_code_usage table already tracks per-customer usage
-- The validate-discount-code function already prevents customers from using the same code twice
-- This ensures each customer can only use RENEWAL20 once, regardless of when their renewal is due