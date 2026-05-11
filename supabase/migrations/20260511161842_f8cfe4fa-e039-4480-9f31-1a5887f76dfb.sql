ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC NOT NULL DEFAULT 0;

INSERT INTO public.discount_codes (code, type, value, valid_from, valid_to, usage_limit, used_count, active, archived, campaign_source, applicable_products, min_order_amount)
VALUES (
  'SAVE25GO',
  'fixed',
  25,
  now(),
  now() + interval '10 years',
  NULL,
  0,
  true,
  false,
  'SAVE',
  '[]'::jsonb,
  0
)
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  value = EXCLUDED.value,
  active = true,
  archived = false,
  min_order_amount = 0,
  valid_to = EXCLUDED.valid_to;