
CREATE OR REPLACE FUNCTION public.reset_agent_caps_daily()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Reset today's counters AND clear the rotation cursor so fair-fill
    -- starts fresh each day (nobody gets stuck at the back of the queue
    -- because of yesterday's last_assigned_at timestamp).
    UPDATE agent_distribution_caps
    SET assigned_today = 0,
        last_assigned_at = NULL,
        cap_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE cap_reset_date IS NULL
       OR cap_reset_date < CURRENT_DATE;
END;
$function$;

-- Run once now so today's stale cursors are cleared immediately for
-- agents whose counter already reset at midnight UTC.
UPDATE agent_distribution_caps
SET last_assigned_at = NULL,
    updated_at = NOW()
WHERE cap_reset_date = CURRENT_DATE
  AND last_assigned_at IS NOT NULL
  AND last_assigned_at::date < CURRENT_DATE;
