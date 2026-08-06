CREATE TABLE public.concession_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  allow_3mo INTEGER NOT NULL DEFAULT 10,
  allow_6mo INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, year_month)
);

CREATE INDEX idx_concession_allowances_lookup ON public.concession_allowances(admin_user_id, year_month);

CREATE TABLE public.concession_auth_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('3mo', '6mo')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decision_note TEXT,
  decided_at TIMESTAMP WITH TIME ZONE,
  seen_by_requester BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_concession_auth_requests_status ON public.concession_auth_requests (status, created_at DESC);
CREATE INDEX idx_concession_auth_requests_admin ON public.concession_auth_requests (admin_user_id, year_month, created_at DESC);

CREATE OR REPLACE FUNCTION public.current_admin_user_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT id FROM public.admin_users WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_concession_usage(p_admin_user_id uuid, p_year_month text)
RETURNS TABLE (used_3mo bigint, used_6mo bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH bounds AS (
    SELECT
      (p_year_month || '-01')::date AT TIME ZONE 'Europe/London' AS month_start,
      ((p_year_month || '-01')::date + INTERVAL '1 month') AT TIME ZONE 'Europe/London' AS month_end
  )
  SELECT
    COALESCE(count(*) FILTER (WHERE c.seasonal_bonus_months = 3), 0)::bigint AS used_3mo,
    COALESCE(count(*) FILTER (WHERE c.seasonal_bonus_months = 6), 0)::bigint AS used_6mo
  FROM public.customers c
  CROSS JOIN bounds b
  WHERE c.assigned_to = p_admin_user_id
    AND c.signup_date >= b.month_start
    AND c.signup_date < b.month_end
    AND c.seasonal_bonus_months IN (3, 6)
    AND c.status NOT IN ('Cancelled', 'Refunded');
$$;

GRANT EXECUTE ON FUNCTION public.get_concession_usage(uuid, text) TO authenticated;

ALTER TABLE public.concession_allowances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concession_auth_requests ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.concession_allowances TO authenticated;
GRANT ALL ON public.concession_allowances TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.concession_auth_requests TO authenticated;
GRANT ALL ON public.concession_auth_requests TO service_role;

CREATE POLICY "Agents view own concession allowances"
ON public.concession_allowances FOR SELECT TO authenticated
USING (admin_user_id = public.current_admin_user_id());

CREATE POLICY "Management view all concession allowances"
ON public.concession_allowances FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Management manage concession allowances"
ON public.concession_allowances FOR ALL TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Agents raise own concession requests"
ON public.concession_auth_requests FOR INSERT TO authenticated
WITH CHECK (admin_user_id = public.current_admin_user_id());

CREATE POLICY "Agents view own concession requests"
ON public.concession_auth_requests FOR SELECT TO authenticated
USING (admin_user_id = public.current_admin_user_id());

CREATE POLICY "Agents mark own concession requests seen"
ON public.concession_auth_requests FOR UPDATE TO authenticated
USING (admin_user_id = public.current_admin_user_id())
WITH CHECK (admin_user_id = public.current_admin_user_id());

CREATE POLICY "Management view all concession requests"
ON public.concession_auth_requests FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Management decide concession requests"
ON public.concession_auth_requests FOR UPDATE TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE TRIGGER update_concession_allowances_updated_at
BEFORE UPDATE ON public.concession_allowances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_concession_auth_requests_updated_at
BEFORE UPDATE ON public.concession_auth_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.concession_allowances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.concession_auth_requests;
