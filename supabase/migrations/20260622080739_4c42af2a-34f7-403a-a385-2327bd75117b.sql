
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

-- Add INSERT policy for sales_leads on agent_distribution_caps so "Add Agent" works
DROP POLICY IF EXISTS "Sales leads can insert caps when access granted" ON public.agent_distribution_caps;
CREATE POLICY "Sales leads can insert caps when access granted"
ON public.agent_distribution_caps
FOR INSERT
TO authenticated
WITH CHECK (
  is_sales_lead(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE config_key = 'sales_lead_distribution_access'
      AND config_value = true
  )
);
