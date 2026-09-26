CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.can_manage_monthly_revenue_targets(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'super_admin')
      AND is_active = true
  );
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_monthly_revenue_targets(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_monthly_revenue_targets(uuid) TO service_role;

DROP POLICY "Admins can create monthly revenue targets" ON public.monthly_revenue_targets;
DROP POLICY "Admins can update monthly revenue targets" ON public.monthly_revenue_targets;
DROP POLICY "Admins can delete monthly revenue targets" ON public.monthly_revenue_targets;

CREATE POLICY "Admins can create monthly revenue targets"
ON public.monthly_revenue_targets
FOR INSERT
TO authenticated
WITH CHECK (private.can_manage_monthly_revenue_targets((SELECT auth.uid())));

CREATE POLICY "Admins can update monthly revenue targets"
ON public.monthly_revenue_targets
FOR UPDATE
TO authenticated
USING (private.can_manage_monthly_revenue_targets((SELECT auth.uid())))
WITH CHECK (private.can_manage_monthly_revenue_targets((SELECT auth.uid())));

CREATE POLICY "Admins can delete monthly revenue targets"
ON public.monthly_revenue_targets
FOR DELETE
TO authenticated
USING (private.can_manage_monthly_revenue_targets((SELECT auth.uid())));

DROP FUNCTION public.can_manage_monthly_revenue_targets(uuid);