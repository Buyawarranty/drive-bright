-- Unarchive EMAIL25SAVE code and extend its validity
UPDATE discount_codes 
SET 
  archived = false,
  active = true,
  valid_from = NOW(),
  valid_to = NOW() + INTERVAL '30 days',
  auto_archived_at = NULL,
  auto_archived_reason = NULL
WHERE code = 'EMAIL25SAVE';