ALTER TABLE public.agent_distribution_caps ADD COLUMN IF NOT EXISTS can_reassign_leads boolean NOT NULL DEFAULT false;
ALTER TABLE public.agent_distribution_caps ADD COLUMN IF NOT EXISTS reassign_scope text NOT NULL DEFAULT 'own_team';

-- Backfill: existing team leads keep the reassign access they already had
UPDATE public.agent_distribution_caps adc
SET can_reassign_leads = true, reassign_scope = 'own_team'
FROM public.admin_users au
WHERE adc.admin_user_id = au.id
  AND au.role = 'sales_lead'
  AND au.is_active = true;

-- Also backfill any sales_lead without a cap row yet
INSERT INTO public.agent_distribution_caps (admin_user_id, can_reassign_leads, reassign_scope)
SELECT au.id, true, 'own_team'
FROM public.admin_users au
WHERE au.role = 'sales_lead'
  AND au.is_active = true
  AND NOT EXISTS (SELECT 1 FROM public.agent_distribution_caps c WHERE c.admin_user_id = au.id);

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
        au.role IN ('super_admin','admin','performance_manager','sales_manager')
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
        WHEN au.role IN ('super_admin','admin','performance_manager','sales_manager') THEN 'all_teams'
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