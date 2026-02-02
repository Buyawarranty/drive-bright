-- Add percentage column to agent_distribution_caps for percentage-based distribution
ALTER TABLE public.agent_distribution_caps 
ADD COLUMN IF NOT EXISTS percentage INTEGER DEFAULT 0;

-- Add a comment explaining the column
COMMENT ON COLUMN public.agent_distribution_caps.percentage IS 'Percentage of leads to assign to this agent when using percentage distribution mode. Should sum to 100 across all active agents.';

-- Update the reset_daily_caps function to properly reset caps at midnight
CREATE OR REPLACE FUNCTION public.reset_daily_caps()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Reset caps for all agents where the reset date is before today
    UPDATE agent_distribution_caps
    SET assigned_today = 0,
        cap_reset_date = CURRENT_DATE,
        updated_at = now()
    WHERE cap_reset_date IS NULL OR cap_reset_date < CURRENT_DATE;
END;
$function$;

-- Run the reset function now to fix stale dates
SELECT public.reset_daily_caps();