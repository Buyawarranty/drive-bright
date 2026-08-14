CREATE TABLE public.ai_chat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.ai_sandbox_threads(id) ON DELETE CASCADE,
  user_id uuid,
  event_type text NOT NULL,
  topic text,
  detail text,
  customer_wording text,
  registration text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  quoted_price numeric,
  plan_name text,
  term_months integer,
  knowledge_confident boolean,
  is_sandbox boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_events_created_at ON public.ai_chat_events (created_at DESC);
CREATE INDEX idx_ai_chat_events_type ON public.ai_chat_events (event_type);
CREATE INDEX idx_ai_chat_events_thread ON public.ai_chat_events (thread_id);

GRANT SELECT ON public.ai_chat_events TO authenticated;
GRANT ALL ON public.ai_chat_events TO service_role;

ALTER TABLE public.ai_chat_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can read chat insights"
ON public.ai_chat_events FOR SELECT TO authenticated
USING (public.is_management(auth.uid()) OR public.is_super_admin());