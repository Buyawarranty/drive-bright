CREATE TABLE public.ai_sandbox_specialist_presence (
  user_id uuid PRIMARY KEY,
  display_name text,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sandbox_specialist_presence TO authenticated;
GRANT ALL ON public.ai_sandbox_specialist_presence TO service_role;

ALTER TABLE public.ai_sandbox_specialist_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view specialist presence"
  ON public.ai_sandbox_specialist_presence FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Specialists manage their own presence"
  ON public.ai_sandbox_specialist_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Specialists update their own presence"
  ON public.ai_sandbox_specialist_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Specialists delete their own presence"
  ON public.ai_sandbox_specialist_presence FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_ai_sandbox_presence_updated_at
  BEFORE UPDATE ON public.ai_sandbox_specialist_presence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ai_sandbox_handovers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_sandbox_handovers;