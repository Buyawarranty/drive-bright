CREATE OR REPLACE FUNCTION public.pick_agent_for_distribution(p_team_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN public.pick_agent_for_distribution(p_team_id, NULL::text);
END;
$$;