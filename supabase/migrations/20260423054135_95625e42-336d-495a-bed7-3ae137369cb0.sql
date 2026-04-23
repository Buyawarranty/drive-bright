INSERT INTO public.discount_codes (code, type, value, active, valid_from, valid_to, usage_limit, used_count, applicable_products)
VALUES ('SAVE50', 'fixed', 50, true, now() - interval '1 day', now() + interval '10 years', 1000000, 0, '["all"]'::jsonb)
ON CONFLICT (code) DO UPDATE SET
  active = true,
  type = 'fixed',
  value = 50,
  valid_from = LEAST(public.discount_codes.valid_from, now() - interval '1 day'),
  valid_to = GREATEST(public.discount_codes.valid_to, now() + interval '10 years'),
  usage_limit = GREATEST(COALESCE(public.discount_codes.usage_limit, 0), 1000000),
  archived = false,
  updated_at = now();