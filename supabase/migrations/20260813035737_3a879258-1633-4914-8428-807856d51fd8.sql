CREATE TABLE public.ai_sandbox_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.ai_sandbox_threads(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  kind text NOT NULL DEFAULT 'live_handover',
  customer_name text,
  customer_email text,
  customer_phone text,
  registration text,
  cover_summary text,
  quoted_price numeric,
  reason text,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'waiting',
  claimed_by uuid,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.ai_sandbox_handovers TO authenticated;
GRANT ALL ON public.ai_sandbox_handovers TO service_role;

ALTER TABLE public.ai_sandbox_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their sandbox handovers"
  ON public.ai_sandbox_handovers FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.is_management(auth.uid()) OR public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Owners can create sandbox handovers"
  ON public.ai_sandbox_handovers FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Staff can update sandbox handovers"
  ON public.ai_sandbox_handovers FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_management(auth.uid()) OR public.is_admin_or_sales(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_management(auth.uid()) OR public.is_admin_or_sales(auth.uid()));

CREATE INDEX idx_ai_sandbox_handovers_status ON public.ai_sandbox_handovers (status, created_at DESC);
CREATE INDEX idx_ai_sandbox_handovers_thread ON public.ai_sandbox_handovers (thread_id);

CREATE TRIGGER trg_ai_sandbox_handovers_updated_at
  BEFORE UPDATE ON public.ai_sandbox_handovers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();