CREATE OR REPLACE FUNCTION public.is_super_admin_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = _user_id AND role = 'super_admin' AND is_active = true)
$$;

CREATE TABLE public.growth_agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_threads TO authenticated;
GRANT ALL ON public.growth_agent_threads TO service_role;
ALTER TABLE public.growth_agent_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage own growth threads" ON public.growth_agent_threads FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_super_admin_user(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_super_admin_user(auth.uid()));

CREATE TABLE public.growth_agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.growth_agent_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL,
  sdk_message_id text,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX growth_agent_messages_thread_idx ON public.growth_agent_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.growth_agent_messages TO authenticated;
GRANT ALL ON public.growth_agent_messages TO service_role;
ALTER TABLE public.growth_agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins read own growth messages" ON public.growth_agent_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_super_admin_user(auth.uid()));
CREATE POLICY "Super admins delete own growth messages" ON public.growth_agent_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_super_admin_user(auth.uid()));