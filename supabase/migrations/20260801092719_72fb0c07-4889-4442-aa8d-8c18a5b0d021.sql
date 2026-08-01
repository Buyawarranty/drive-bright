CREATE TABLE public.discount_auth_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requested_by_user_id UUID NOT NULL DEFAULT auth.uid(),
  requested_by_name TEXT,
  registration_plate TEXT,
  mileage TEXT,
  vehicle_description TEXT,
  customer_name TEXT,
  base_price NUMERIC,
  requested_price NUMERIC,
  discount_pct NUMERIC,
  payment_type TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by_user_id UUID,
  decided_by_name TEXT,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  seen_by_requester BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.discount_auth_requests TO authenticated;
GRANT ALL ON public.discount_auth_requests TO service_role;

ALTER TABLE public.discount_auth_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can raise their own discount requests"
ON public.discount_auth_requests FOR INSERT TO authenticated
WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "Requesters see their own requests"
ON public.discount_auth_requests FOR SELECT TO authenticated
USING (requested_by_user_id = auth.uid());

CREATE POLICY "Requesters can mark their own request seen"
ON public.discount_auth_requests FOR UPDATE TO authenticated
USING (requested_by_user_id = auth.uid())
WITH CHECK (requested_by_user_id = auth.uid());

CREATE POLICY "Management see all discount requests"
ON public.discount_auth_requests FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Management decide discount requests"
ON public.discount_auth_requests FOR UPDATE TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE INDEX idx_discount_auth_requests_status ON public.discount_auth_requests (status, created_at DESC);
CREATE INDEX idx_discount_auth_requests_requester ON public.discount_auth_requests (requested_by_user_id, created_at DESC);

CREATE TRIGGER update_discount_auth_requests_updated_at
BEFORE UPDATE ON public.discount_auth_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.discount_auth_requests;