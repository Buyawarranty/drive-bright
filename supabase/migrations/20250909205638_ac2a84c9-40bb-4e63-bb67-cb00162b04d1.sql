UPDATE discount_codes 
SET valid_to = '2025-10-31 23:59:59+00'::timestamptz,
    updated_at = now()
WHERE code = '99OFF';