-- Extend the validity period of the NINEFIVE discount code
UPDATE discount_codes 
SET valid_to = now() + INTERVAL '30 days',
    updated_at = now()
WHERE code = 'NINEFIVE';