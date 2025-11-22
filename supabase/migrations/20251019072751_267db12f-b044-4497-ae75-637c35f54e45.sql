-- Update COMEBACK10 to SAVE10NOW
UPDATE public.discount_codes 
SET code = 'SAVE10NOW'
WHERE code = 'COMEBACK10';

-- If COMEBACK10 doesn't exist yet, create SAVE10NOW
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
  'SAVE10NOW',
  'percentage',
  10,
  now(),
  now() + interval '10 years',
  NULL,
  true,
  'abandoned_cart_campaign',
  '["all"]'::jsonb
)
ON CONFLICT (code) DO NOTHING;