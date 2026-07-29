GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_teams TO authenticated;
GRANT ALL ON public.lead_teams TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_team_members TO authenticated;
GRANT ALL ON public.lead_team_members TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_distribution_caps TO authenticated;
GRANT ALL ON public.agent_distribution_caps TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.overflow_recipients TO authenticated;
GRANT ALL ON public.overflow_recipients TO service_role;