CREATE TABLE IF NOT EXISTS public.agent_break_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL UNIQUE REFERENCES public.admin_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available',
  reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_back_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT agent_break_status_status_check CHECK (status IN ('available','break','lunch','training','meeting','off'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_break_status TO authenticated;
GRANT ALL ON public.agent_break_status TO service_role;

ALTER TABLE public.agent_break_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view break status"
ON public.agent_break_status FOR SELECT TO authenticated
USING (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid() AND au.is_active = true AND au.role = 'performance_manager'
  )
);

CREATE POLICY "Staff can set own break status"
ON public.agent_break_status FOR INSERT TO authenticated
WITH CHECK (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
);

CREATE POLICY "Staff can update own break status"
ON public.agent_break_status FOR UPDATE TO authenticated
USING (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
)
WITH CHECK (
  admin_user_id = public.current_admin_user_id()
  OR public.is_management(auth.uid())
);

CREATE TRIGGER update_agent_break_status_updated_at
BEFORE UPDATE ON public.agent_break_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_break_status;