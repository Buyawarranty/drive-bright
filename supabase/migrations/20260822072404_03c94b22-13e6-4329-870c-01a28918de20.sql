-- Turn off automatic lead pausing entirely; managers pause manually
CREATE OR REPLACE FUNCTION public.evaluate_agent_lead_freeze()
RETURNS TABLE(admin_user_id uuid, outcome text, reason text, freeze_days integer, frozen_until date, sales_in_window integer, revenue_mtd numeric, pro_rata_target numeric, monthly_target numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatic freezing removed by request: lead pausing is a manual manager action.
  RETURN;
END;
$$;

-- Lift every freeze that was applied automatically
UPDATE public.agent_distribution_caps
SET paused = false,
    freeze_source = NULL,
    freeze_reason = NULL,
    frozen_until = NULL
WHERE freeze_source = 'auto' OR (paused = true AND freeze_source IS NULL);

-- Stop auto-freeze from being re-enabled per agent
UPDATE public.agent_distribution_caps SET auto_freeze_enabled = false WHERE auto_freeze_enabled IS DISTINCT FROM false;
ALTER TABLE public.agent_distribution_caps ALTER COLUMN auto_freeze_enabled SET DEFAULT false;