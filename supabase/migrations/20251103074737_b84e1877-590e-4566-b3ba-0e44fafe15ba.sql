-- Fix the discount code '99OFFNOW' dates (typo: 2034 should be 2024)
UPDATE discount_codes 
SET 
  valid_from = '2024-11-24 00:00:00+00'::timestamptz,
  valid_to = '2025-12-31 23:59:59.999+00'::timestamptz,
  updated_at = now()
WHERE code = '99OFFNOW';