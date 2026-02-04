-- Set James Reed as solo agent with unlimited leads (no cap)
UPDATE agent_distribution_caps 
SET daily_cap = NULL, percentage = 100 
WHERE admin_user_id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';

-- Enable solo mode for James Reed
UPDATE lead_distribution_settings 
SET distribution_mode = 'round_robin', 
    solo_mode_enabled = true, 
    solo_agent_id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';