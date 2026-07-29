CREATE OR REPLACE FUNCTION public.can_manage_lead_routing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = _user_id
      AND au.is_active = true
      AND (
        au.role IN ('super_admin','admin','performance_manager','sales_manager','lead_gen','accounts_manager','accounts')
        OR EXISTS (
          SELECT 1 FROM public.agent_distribution_caps adc
          WHERE adc.admin_user_id = au.id
            AND adc.can_reassign_leads = true
        )
        OR (
          au.role = 'sales_lead'
          AND EXISTS (
            SELECT 1 FROM public.admin_config
            WHERE config_key = 'sales_lead_distribution_access'
              AND config_value = true
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.lead_routing_scope(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN au.role IN ('super_admin','admin','performance_manager','sales_manager','lead_gen','accounts_manager','accounts') THEN 'all_teams'
        WHEN adc.can_reassign_leads THEN adc.reassign_scope
        WHEN au.role = 'sales_lead' AND EXISTS (
          SELECT 1 FROM public.admin_config
          WHERE config_key = 'sales_lead_distribution_access'
            AND config_value = true
        ) THEN 'own_team'
        ELSE NULL
      END
      FROM public.admin_users au
      LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id = au.id
      WHERE au.user_id = _user_id
        AND au.is_active = true
      LIMIT 1
    ),
    NULL
  );
$$;