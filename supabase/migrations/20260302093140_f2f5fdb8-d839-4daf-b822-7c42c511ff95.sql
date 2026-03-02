-- Clean up round_robin_state to have only one canonical row
-- Keep the most recent one and delete the rest
DELETE FROM round_robin_state 
WHERE id NOT IN (
  SELECT id FROM round_robin_state 
  ORDER BY updated_at DESC 
  LIMIT 1
);