
CREATE TABLE public.missed_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'callrail',
  caller_phone text,
  caller_name text,
  tracking_number text,
  call_status text,
  call_duration integer,
  recording_url text,
  call_started_at timestamptz,
  matched_lead_id uuid,
  matched_customer_id uuid,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'active',
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX missed_calls_status_created_idx ON public.missed_calls(status, created_at DESC);
CREATE INDEX missed_calls_phone_idx ON public.missed_calls(caller_phone);

GRANT SELECT, UPDATE ON public.missed_calls TO authenticated;
GRANT ALL ON public.missed_calls TO service_role;

ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view missed calls"
ON public.missed_calls FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.role IN ('admin','super_admin','sales','sales_lead','accounts','accounts_manager','performance_manager','claims_agent','claims_manager','lead_gen')
      AND au.is_active = true
  )
);

CREATE POLICY "Staff can update missed calls"
ON public.missed_calls FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.role IN ('admin','super_admin','sales','sales_lead','accounts','accounts_manager','performance_manager','claims_agent','claims_manager','lead_gen')
      AND au.is_active = true
  )
);

CREATE POLICY "Service role manages missed calls"
ON public.missed_calls FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_missed_calls_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_missed_calls_updated_at
BEFORE UPDATE ON public.missed_calls
FOR EACH ROW EXECUTE FUNCTION public.update_missed_calls_updated_at();

ALTER TABLE public.missed_calls REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.missed_calls;
