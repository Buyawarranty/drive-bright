-- Make EMAIL25SAVE work indefinitely
UPDATE discount_codes 
SET 
  valid_to = NOW() + INTERVAL '100 years',
  archived = false,
  active = true
WHERE code = 'EMAIL25SAVE';