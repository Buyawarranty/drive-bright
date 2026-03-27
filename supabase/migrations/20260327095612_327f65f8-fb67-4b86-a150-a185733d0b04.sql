-- Fix sort_order gap: Ash should be 2 not 3 for strict James(1) → Ash(2) cycle
UPDATE agent_distribution_caps 
SET sort_order = 2, updated_at = now()
WHERE admin_user_id = '7083d831-4634-47a4-b3e2-61ac9908bf85' AND sort_order = 3;