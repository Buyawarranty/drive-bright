-- Disable active_only_distribution so all ON agents receive leads
-- regardless of online/offline status (strict round-robin 1→2→3)
UPDATE lead_distribution_settings 
SET active_only_distribution = false;