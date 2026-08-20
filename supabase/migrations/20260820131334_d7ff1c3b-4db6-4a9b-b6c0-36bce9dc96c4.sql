CREATE TABLE public.lead_reassign_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  lead_label text,
  lead_reg text,
  current_owner_id uuid,
  requested_by uuid NOT NULL,
  requested_to uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  manager_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_reassign_requests_status ON public.lead_reassign_requests (status, created_at DESC);
CREATE INDEX idx_lead_reassign_requests_lead ON public.lead_reassign_requests (lead_id);
CREATE UNIQUE INDEX idx_lead_reassign_requests_open ON public.lead_reassign_requests (lead_id, requested_by) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.lead_reassign_requests TO authenticated;
GRANT ALL ON public.lead_reassign_requests TO service_role;

ALTER TABLE public.lead_reassign_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view handover requests"
ON public.lead_reassign_requests FOR SELECT TO authenticated
USING (public.is_active_admin_user(auth.uid()));

CREATE POLICY "Staff can create handover requests"
ON public.lead_reassign_requests FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin_user(auth.uid()));

CREATE POLICY "Managers can review handover requests"
ON public.lead_reassign_requests FOR UPDATE TO authenticated
USING (public.can_manage_lead_routing(auth.uid()))
WITH CHECK (public.can_manage_lead_routing(auth.uid()));

CREATE TRIGGER trg_lead_reassign_requests_updated_at
BEFORE UPDATE ON public.lead_reassign_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();