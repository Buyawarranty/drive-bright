
CREATE TABLE public.phone_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID,
  agent_name TEXT,
  lead_id TEXT,
  lead_type TEXT,
  customer_id UUID,
  customer_name TEXT,
  phone_number TEXT,
  lead_source TEXT,
  event_type TEXT NOT NULL,
  selected_outcome TEXT,
  source_page TEXT,
  reservation_id UUID,
  session_id TEXT,
  ip_address TEXT,
  recording_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_events_agent_created ON public.phone_events(agent_id, created_at DESC);
CREATE INDEX idx_phone_events_lead ON public.phone_events(lead_id);
CREATE INDEX idx_phone_events_event_type ON public.phone_events(event_type);
CREATE INDEX idx_phone_events_created_at ON public.phone_events(created_at DESC);

GRANT SELECT, INSERT ON public.phone_events TO authenticated;
GRANT ALL ON public.phone_events TO service_role;

ALTER TABLE public.phone_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_phone_logs_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND role = ANY (ARRAY['admin'::user_role, 'super_admin'::user_role, 'sales_manager'::user_role, 'performance_manager'::user_role])
  );
$$;

CREATE POLICY "Authenticated can insert phone events"
  ON public.phone_events FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Agents view own; managers view all"
  ON public.phone_events FOR SELECT TO authenticated
  USING (
    public.is_phone_logs_manager(auth.uid())
    OR agent_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE TABLE public.phone_event_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_event_id UUID NOT NULL REFERENCES public.phone_events(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL,
  manager_name TEXT,
  result TEXT NOT NULL,
  notes TEXT,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_phone_verif_event ON public.phone_event_verifications(phone_event_id);
CREATE INDEX idx_phone_verif_created ON public.phone_event_verifications(created_at DESC);

GRANT SELECT, INSERT ON public.phone_event_verifications TO authenticated;
GRANT ALL ON public.phone_event_verifications TO service_role;

ALTER TABLE public.phone_event_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view verifications"
  ON public.phone_event_verifications FOR SELECT TO authenticated
  USING (
    public.is_phone_logs_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.phone_events pe
      JOIN public.admin_users au ON au.id = pe.agent_id
      WHERE pe.id = phone_event_verifications.phone_event_id
        AND au.user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert verifications"
  ON public.phone_event_verifications FOR INSERT TO authenticated
  WITH CHECK (public.is_phone_logs_manager(auth.uid()));

CREATE TABLE public.open_pool_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  agent_name TEXT,
  level INTEGER NOT NULL,
  mismatch_event_id UUID REFERENCES public.phone_events(id),
  verification_id UUID REFERENCES public.phone_event_verifications(id),
  duration_active_hours NUMERIC,
  duration_working_days INTEGER,
  active_hours_remaining NUMERIC,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pool_restr_agent_status ON public.open_pool_restrictions(agent_id, status);
CREATE INDEX idx_pool_restr_status ON public.open_pool_restrictions(status);

GRANT SELECT ON public.open_pool_restrictions TO authenticated;
GRANT ALL ON public.open_pool_restrictions TO service_role;

ALTER TABLE public.open_pool_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own; managers see all restrictions"
  ON public.open_pool_restrictions FOR SELECT TO authenticated
  USING (
    public.is_phone_logs_manager(auth.uid())
    OR agent_id IN (SELECT id FROM public.admin_users WHERE user_id = auth.uid())
  );

CREATE TRIGGER update_open_pool_restrictions_updated_at
  BEFORE UPDATE ON public.open_pool_restrictions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
