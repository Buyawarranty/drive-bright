CREATE OR REPLACE FUNCTION public.can_use_growth_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true
      AND (role = 'super_admin' OR (permissions ->> 'tab_growth-agent') = 'true')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.can_use_growth_agent(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_growth_agent(uuid) TO authenticated, service_role;

DROP POLICY "Super admins manage own growth threads" ON public.growth_agent_threads;
CREATE POLICY "Growth assistant users manage own threads" ON public.growth_agent_threads FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.can_use_growth_agent(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.can_use_growth_agent(auth.uid()));

DROP POLICY "Super admins read own growth messages" ON public.growth_agent_messages;
DROP POLICY "Super admins delete own growth messages" ON public.growth_agent_messages;
CREATE POLICY "Growth assistant users read own messages" ON public.growth_agent_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.can_use_growth_agent(auth.uid()));
CREATE POLICY "Growth assistant users delete own messages" ON public.growth_agent_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.can_use_growth_agent(auth.uid()));