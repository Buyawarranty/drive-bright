CREATE TABLE public.ai_sandbox_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  is_sandbox BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_sandbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.ai_sandbox_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  sdk_message_id TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_sandbox_messages_thread ON public.ai_sandbox_messages(thread_id, created_at);
CREATE INDEX idx_ai_sandbox_threads_user ON public.ai_sandbox_threads(user_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sandbox_threads TO authenticated;
GRANT ALL ON public.ai_sandbox_threads TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sandbox_messages TO authenticated;
GRANT ALL ON public.ai_sandbox_messages TO service_role;

ALTER TABLE public.ai_sandbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sandbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage own sandbox threads"
ON public.ai_sandbox_threads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Management view all sandbox threads"
ON public.ai_sandbox_threads FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Staff manage own sandbox messages"
ON public.ai_sandbox_messages FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Management view all sandbox messages"
ON public.ai_sandbox_messages FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE TRIGGER trg_ai_sandbox_threads_updated_at
BEFORE UPDATE ON public.ai_sandbox_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();