-- Update Gold plan to change "Recovery" to "Recovery claim-back"
UPDATE plans 
SET coverage = ARRAY(
  SELECT CASE 
    WHEN element = 'Recovery' THEN 'Recovery claim-back'
    ELSE element
  END
  FROM unnest(coverage) AS element
)
WHERE name = 'Gold' AND is_active = true;

-- Update Platinum plan to change "Recovery" to "Recovery claim-back"
UPDATE plans 
SET coverage = ARRAY(
  SELECT CASE 
    WHEN element = 'Recovery' THEN 'Recovery claim-back'
    ELSE element
  END
  FROM unnest(coverage) AS element
)
WHERE name = 'Platinum' AND is_active = true;