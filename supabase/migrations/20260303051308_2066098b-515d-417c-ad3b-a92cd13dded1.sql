
-- Reset all assigned_today counters to 0 for a fresh start today
UPDATE public.agent_distribution_caps
SET assigned_today = 0,
    cap_reset_date = CURRENT_DATE,
    updated_at = now();
