
CREATE TABLE IF NOT EXISTS public.agent_working_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  day_type text NOT NULL DEFAULT 'full_day' CHECK (day_type IN ('full_day','half_day')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_agent_working_days_date ON public.agent_working_days(work_date);
CREATE INDEX IF NOT EXISTS idx_agent_working_days_admin ON public.agent_working_days(admin_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_working_days TO authenticated;
GRANT ALL ON public.agent_working_days TO service_role;

ALTER TABLE public.agent_working_days ENABLE ROW LEVEL SECURITY;

-- Everyone in admin_users can read (needed for lead allocation visibility)
CREATE POLICY "Admin users can view working days"
ON public.agent_working_days FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid())
);

-- Users can insert their own rows
CREATE POLICY "Users insert own working days"
ON public.agent_working_days FOR INSERT
TO authenticated
WITH CHECK (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin','sales_manager','claims_manager','performance_manager'))
);

CREATE POLICY "Users update own working days"
ON public.agent_working_days FOR UPDATE
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin','sales_manager','claims_manager','performance_manager'))
);

CREATE POLICY "Users delete own working days"
ON public.agent_working_days FOR DELETE
TO authenticated
USING (
  admin_user_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND au.role IN ('super_admin','admin','sales_manager','claims_manager','performance_manager'))
);

CREATE TRIGGER trg_agent_working_days_updated
BEFORE UPDATE ON public.agent_working_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
