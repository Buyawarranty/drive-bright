-- Fix James Reed's agent distribution cap - unpause and reset counter
UPDATE agent_distribution_caps 
SET paused = false, 
    assigned_today = 0, 
    cap_reset_date = CURRENT_DATE,
    updated_at = NOW()
WHERE admin_user_id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';

-- Also ensure the cap reset happens daily - add trigger if not exists
CREATE OR REPLACE FUNCTION reset_agent_caps_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE agent_distribution_caps
    SET assigned_today = 0,
        cap_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE cap_reset_date < CURRENT_DATE OR cap_reset_date IS NULL;
END;
$$;

-- Call it now to reset any stale caps
SELECT reset_agent_caps_daily();