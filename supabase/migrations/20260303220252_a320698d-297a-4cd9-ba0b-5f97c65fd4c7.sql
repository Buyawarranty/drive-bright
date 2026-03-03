CREATE TABLE public.timesheet_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_user_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  month_year text NOT NULL,
  bonus_type text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  amount decimal(10,2),
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.timesheet_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bonuses"
  ON public.timesheet_bonuses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own bonuses"
  ON public.timesheet_bonuses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all bonuses"
  ON public.timesheet_bonuses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'accounts_manager', 'accounts_payroll')
      AND is_active = true
    )
  );

CREATE POLICY "Admins can update bonuses"
  ON public.timesheet_bonuses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid()
      AND role::text IN ('super_admin', 'admin', 'accounts_manager', 'accounts_payroll')
      AND is_active = true
    )
  );

CREATE TRIGGER update_timesheet_bonuses_updated_at
  BEFORE UPDATE ON public.timesheet_bonuses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();