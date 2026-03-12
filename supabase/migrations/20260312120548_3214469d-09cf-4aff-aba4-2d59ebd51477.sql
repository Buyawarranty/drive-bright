-- Add RLS policy for accounts roles to view all timesheets
CREATE POLICY "Accounts can view all timesheets"
ON public.staff_timesheets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role::text IN ('accounts_manager', 'accounts_payroll')
    AND is_active = true
  )
);

-- Add RLS policy for accounts roles to view all deal_records
CREATE POLICY "Accounts can view all deal_records"
ON public.deal_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role::text IN ('accounts_manager', 'accounts_payroll')
    AND is_active = true
  )
);

-- Add RLS policy for accounts roles to view all commission_records
CREATE POLICY "Accounts can view all commission_records"
ON public.commission_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
    AND role::text IN ('accounts_manager', 'accounts_payroll')
    AND is_active = true
  )
);