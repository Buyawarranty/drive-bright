CREATE TABLE public.claim_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  reminder_kind text NOT NULL DEFAULT 'claim',
  title text NOT NULL,
  notes text,
  due_at timestamptz NOT NULL,
  lead_time_minutes integer NOT NULL DEFAULT 1440,
  snoozed_until timestamptz,
  is_muted boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  assigned_to uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_reminders TO authenticated;
GRANT ALL ON public.claim_reminders TO service_role;

ALTER TABLE public.claim_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view claim reminders"
ON public.claim_reminders FOR SELECT TO authenticated
USING (public.is_staff());

CREATE POLICY "Staff can create claim reminders"
ON public.claim_reminders FOR INSERT TO authenticated
WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update claim reminders"
ON public.claim_reminders FOR UPDATE TO authenticated
USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE POLICY "Staff can delete claim reminders"
ON public.claim_reminders FOR DELETE TO authenticated
USING (public.is_staff());

CREATE INDEX idx_claim_reminders_due ON public.claim_reminders (status, due_at);
CREATE INDEX idx_claim_reminders_claim ON public.claim_reminders (claim_id);

CREATE TRIGGER trg_claim_reminders_updated_at
BEFORE UPDATE ON public.claim_reminders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();