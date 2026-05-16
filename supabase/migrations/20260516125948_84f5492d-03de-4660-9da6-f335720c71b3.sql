INSERT INTO public.discount_codes (code, type, value, min_order_amount, active, valid_to, usage_limit, used_count, applicable_products, campaign_source)
VALUES ('SAVE25', 'fixed', 25.00, 0, true, '2036-12-31 23:59:59+00', 1000000, 0, '{}', 'exit_intent_popup')
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type,
  value = EXCLUDED.value,
  min_order_amount = 0,
  active = true,
  valid_to = EXCLUDED.valid_to,
  archived = false;