DROP POLICY IF EXISTS "Admin users can view working days" ON public.agent_working_days;
DROP POLICY IF EXISTS "Own or management can view working days" ON public.agent_working_days;
CREATE POLICY "Own or management can view working days"
ON public.agent_working_days
FOR SELECT
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.role::text = ANY (ARRAY['super_admin','admin','sales_manager','claims_manager','performance_manager','accounts_manager','accounts_payroll'])
  )
);

DROP POLICY IF EXISTS "Admin users can view weekend shifts" ON public.agent_weekend_shifts;
DROP POLICY IF EXISTS "Own or management can view weekend shifts" ON public.agent_weekend_shifts;
CREATE POLICY "Own or management can view weekend shifts"
ON public.agent_weekend_shifts
FOR SELECT
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.role::text = ANY (ARRAY['super_admin','admin','sales_manager','claims_manager','performance_manager','accounts_manager','accounts_payroll'])
  )
);