UPDATE public.discount_codes
SET is_public = false, updated_at = now()
WHERE is_public = true
  AND code NOT IN ('5PERCENTSAVENOW', 'PERCENT5', '50POUNDSOFF', 'SAVE25NOW');

-- Ensure the 4 kept codes are public, active, not archived
UPDATE public.discount_codes
SET is_public = true, active = true, archived = false, updated_at = now()
WHERE code IN ('5PERCENTSAVENOW', 'PERCENT5', '50POUNDSOFF', 'SAVE25NOW');