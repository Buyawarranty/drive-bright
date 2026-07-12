
-- Allow managers to insert / update restrictions from the Phone Logs page
GRANT INSERT, UPDATE ON public.open_pool_restrictions TO authenticated;

CREATE POLICY "Managers can create restrictions"
  ON public.open_pool_restrictions FOR INSERT TO authenticated
  WITH CHECK (public.is_phone_logs_manager(auth.uid()));

CREATE POLICY "Managers can end restrictions"
  ON public.open_pool_restrictions FOR UPDATE TO authenticated
  USING (public.is_phone_logs_manager(auth.uid()))
  WITH CHECK (public.is_phone_logs_manager(auth.uid()));

-- Helper: is this agent currently blocked from the Open Pool?
CREATE OR REPLACE FUNCTION public.is_agent_open_pool_restricted(_agent_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.open_pool_restrictions
    WHERE agent_id = _agent_id
      AND status = 'active'
      AND (ends_at IS NULL OR ends_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_agent_open_pool_restricted(uuid) TO authenticated;
