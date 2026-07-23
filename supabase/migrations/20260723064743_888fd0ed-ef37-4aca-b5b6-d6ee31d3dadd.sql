CREATE OR REPLACE FUNCTION public.orr_agent_is_orr_mode(_agent uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT adc.assignment_mode = 'open_pool'
       FROM public.agent_distribution_caps adc
      WHERE adc.admin_user_id = _agent
      LIMIT 1),
    false
  );
$$;