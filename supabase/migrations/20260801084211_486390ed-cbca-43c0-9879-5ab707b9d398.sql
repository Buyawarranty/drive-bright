-- claim_appeals
DROP POLICY IF EXISTS "Staff can manage claim appeals" ON public.claim_appeals;
CREATE POLICY "Staff can manage claim appeals" ON public.claim_appeals
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- claim_audit_log
DROP POLICY IF EXISTS "Staff can read claim audit log" ON public.claim_audit_log;
CREATE POLICY "Staff can read claim audit log" ON public.claim_audit_log
  FOR SELECT TO authenticated USING (public.is_staff());
DROP POLICY IF EXISTS "Staff can write claim audit log" ON public.claim_audit_log;
CREATE POLICY "Staff can write claim audit log" ON public.claim_audit_log
  FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- claim_call_logs
DROP POLICY IF EXISTS "Staff can manage claim call logs" ON public.claim_call_logs;
CREATE POLICY "Staff can manage claim call logs" ON public.claim_call_logs
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- claim_documents
DROP POLICY IF EXISTS "Staff can manage claim documents" ON public.claim_documents;
CREATE POLICY "Staff can manage claim documents" ON public.claim_documents
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- claim_settlements
DROP POLICY IF EXISTS "Staff can manage claim settlements" ON public.claim_settlements;
CREATE POLICY "Staff can manage claim settlements" ON public.claim_settlements
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- claim_update_requests
DROP POLICY IF EXISTS "Admins can manage claim update requests" ON public.claim_update_requests;
CREATE POLICY "Staff can manage claim update requests" ON public.claim_update_requests
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- claim_update_responses
DROP POLICY IF EXISTS "Admins can manage claim update responses" ON public.claim_update_responses;
CREATE POLICY "Staff can manage claim update responses" ON public.claim_update_responses
  FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
-- Public submissions go through the submit-claim-update edge function (service role),
-- so the open anon insert path is no longer needed.
DROP POLICY IF EXISTS "Anyone can insert claim update responses" ON public.claim_update_responses;
REVOKE INSERT ON public.claim_update_responses FROM anon;