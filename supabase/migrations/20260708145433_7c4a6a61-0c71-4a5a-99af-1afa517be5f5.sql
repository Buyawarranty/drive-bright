
-- Garage fields on claims
ALTER TABLE public.claims_submissions
  ADD COLUMN IF NOT EXISTS garage_name text,
  ADD COLUMN IF NOT EXISTS garage_phone text,
  ADD COLUMN IF NOT EXISTS garage_email text;

-- Audit log
CREATE TABLE IF NOT EXISTS public.claim_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  field text,
  old_value text,
  new_value text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.claim_audit_log TO authenticated;
GRANT ALL ON public.claim_audit_log TO service_role;
ALTER TABLE public.claim_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can read claim audit log" ON public.claim_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can write claim audit log" ON public.claim_audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_claim_audit_log_claim ON public.claim_audit_log(claim_id, created_at DESC);

-- Settlement
CREATE TABLE IF NOT EXISTS public.claim_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL UNIQUE REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  approved_amount numeric,
  excess_deducted numeric,
  final_paid_amount numeric,
  payment_date date,
  payment_method text,
  paid_to text,
  invoice_reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_settlements TO authenticated;
GRANT ALL ON public.claim_settlements TO service_role;
ALTER TABLE public.claim_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage claim settlements" ON public.claim_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Appeals
CREATE TABLE IF NOT EXISTS public.claim_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  reason text,
  new_evidence text,
  status text NOT NULL DEFAULT 'submitted',
  outcome text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_appeals TO authenticated;
GRANT ALL ON public.claim_appeals TO service_role;
ALTER TABLE public.claim_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage claim appeals" ON public.claim_appeals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Call logs
CREATE TABLE IF NOT EXISTS public.claim_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  called_party text NOT NULL,
  direction text,
  outcome text,
  summary text,
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_date date,
  logged_by uuid,
  logged_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_call_logs TO authenticated;
GRANT ALL ON public.claim_call_logs TO service_role;
ALTER TABLE public.claim_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage claim call logs" ON public.claim_call_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_claim_call_logs_claim ON public.claim_call_logs(claim_id, created_at DESC);

-- Agent-uploaded claim documents
CREATE TABLE IF NOT EXISTS public.claim_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims_submissions(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  file_type text,
  label text,
  visibility text NOT NULL DEFAULT 'internal',
  uploaded_by uuid,
  uploaded_by_name text,
  uploaded_by_role text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_documents TO authenticated;
GRANT ALL ON public.claim_documents TO service_role;
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can manage claim documents" ON public.claim_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim ON public.claim_documents(claim_id, created_at DESC);

-- updated_at trigger reuse
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_claim_settlements_updated_at ON public.claim_settlements;
CREATE TRIGGER trg_claim_settlements_updated_at BEFORE UPDATE ON public.claim_settlements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_claim_appeals_updated_at ON public.claim_appeals;
CREATE TRIGGER trg_claim_appeals_updated_at BEFORE UPDATE ON public.claim_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
