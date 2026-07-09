ALTER TABLE public.claim_communications
DROP CONSTRAINT IF EXISTS claim_communications_communication_type_check;

ALTER TABLE public.claim_communications
ADD CONSTRAINT claim_communications_communication_type_check
CHECK (communication_type IN ('email', 'phone', 'note', 'status_change'));

ALTER TABLE public.claim_communications
DROP CONSTRAINT IF EXISTS claim_communications_direction_check;

ALTER TABLE public.claim_communications
ADD CONSTRAINT claim_communications_direction_check
CHECK (direction IN ('inbound', 'outbound', 'internal'));

DROP POLICY IF EXISTS "Admins can manage claim communications" ON public.claim_communications;

CREATE POLICY "Staff with claims access can manage claim communications"
ON public.claim_communications
FOR ALL
TO authenticated
USING (public.has_tab_access(auth.uid(), 'claims'))
WITH CHECK (public.has_tab_access(auth.uid(), 'claims'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_communications TO authenticated;
GRANT ALL ON public.claim_communications TO service_role;