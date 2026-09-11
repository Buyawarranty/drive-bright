CREATE TABLE public.ai_chat_answer_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  normalized_question text,
  keywords text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL,
  status text NOT NULL DEFAULT 'approved',
  source_thread_id uuid,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  times_used integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_answer_library TO authenticated;
GRANT ALL ON public.ai_chat_answer_library TO service_role;

ALTER TABLE public.ai_chat_answer_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management manage chatbot answer library"
ON public.ai_chat_answer_library
FOR ALL
TO authenticated
USING (is_management((SELECT auth.uid())) OR is_super_admin())
WITH CHECK (is_management((SELECT auth.uid())) OR is_super_admin());

CREATE INDEX ai_chat_answer_library_status_idx ON public.ai_chat_answer_library (status, updated_at DESC);
CREATE INDEX ai_chat_answer_library_keywords_idx ON public.ai_chat_answer_library USING gin (keywords);

CREATE TRIGGER ai_chat_answer_library_updated_at
BEFORE UPDATE ON public.ai_chat_answer_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();