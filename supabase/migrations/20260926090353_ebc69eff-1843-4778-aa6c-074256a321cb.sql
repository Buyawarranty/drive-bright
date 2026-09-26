CREATE OR REPLACE FUNCTION public.can_manage_monthly_revenue_targets(_user_id uuid)
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

CREATE TABLE public.monthly_revenue_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_month date NOT NULL UNIQUE,
  target_amount numeric(12,2) NOT NULL CHECK (target_amount > 0),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_revenue_targets_month_start CHECK (target_month = date_trunc('month', target_month)::date)
);

GRANT SELECT ON public.monthly_revenue_targets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.monthly_revenue_targets TO authenticated;
GRANT ALL ON public.monthly_revenue_targets TO service_role;

ALTER TABLE public.monthly_revenue_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics staff can view monthly revenue targets"
ON public.monthly_revenue_targets
FOR SELECT
TO authenticated
USING (public.is_admin_or_sales((SELECT auth.uid())));

CREATE POLICY "Admins can create monthly revenue targets"
ON public.monthly_revenue_targets
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_monthly_revenue_targets((SELECT auth.uid())));

CREATE POLICY "Admins can update monthly revenue targets"
ON public.monthly_revenue_targets
FOR UPDATE
TO authenticated
USING (public.can_manage_monthly_revenue_targets((SELECT auth.uid())))
WITH CHECK (public.can_manage_monthly_revenue_targets((SELECT auth.uid())));

CREATE POLICY "Admins can delete monthly revenue targets"
ON public.monthly_revenue_targets
FOR DELETE
TO authenticated
USING (public.can_manage_monthly_revenue_targets((SELECT auth.uid())));

CREATE TRIGGER update_monthly_revenue_targets_updated_at
BEFORE UPDATE ON public.monthly_revenue_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();