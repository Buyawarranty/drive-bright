CREATE TYPE public.agent_feedback_type AS ENUM ('technical_issue', 'customer_feedback', 'lead_timestamp');
CREATE TYPE public.agent_feedback_status AS ENUM ('new', 'reviewed', 'resolved');

CREATE TABLE public.agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  feedback_type public.agent_feedback_type NOT NULL,
  lead_id uuid REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  lead_reference_text text,
  message text NOT NULL,
  status public.agent_feedback_status NOT NULL DEFAULT 'new',
  reviewed_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.agent_feedback TO authenticated;
GRANT ALL ON public.agent_feedback TO service_role;

ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents view own feedback"
  ON public.agent_feedback
  FOR SELECT
  TO authenticated
  USING (submitted_by = (SELECT id FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Agents insert own feedback"
  ON public.agent_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (submitted_by = (SELECT id FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Agents update own feedback"
  ON public.agent_feedback
  FOR UPDATE
  TO authenticated
  USING (submitted_by = (SELECT id FROM public.admin_users WHERE user_id = auth.uid()))
  WITH CHECK (submitted_by = (SELECT id FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "Management view all feedback"
  ON public.agent_feedback
  FOR SELECT
  TO authenticated
  USING (public.is_management(auth.uid()));

CREATE POLICY "Management update all feedback"
  ON public.agent_feedback
  FOR UPDATE
  TO authenticated
  USING (public.is_management(auth.uid()))
  WITH CHECK (public.is_management(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_agent_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER agent_feedback_set_updated_at
  BEFORE UPDATE ON public.agent_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_feedback_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_feedback;
