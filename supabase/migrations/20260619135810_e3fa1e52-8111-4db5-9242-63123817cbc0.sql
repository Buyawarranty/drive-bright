CREATE POLICY "Staff can read distribution config keys"
ON public.admin_config
FOR SELECT
TO authenticated
USING (
  config_key IN (
    'sales_lead_distribution_access',
    'show_assignments_to_agents',
    'allow_agent_self_assign',
    'agents_own_leads_only',
    'team_routing_enabled',
    'website_sales_day_mode'
  )
  AND EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true
  )
);