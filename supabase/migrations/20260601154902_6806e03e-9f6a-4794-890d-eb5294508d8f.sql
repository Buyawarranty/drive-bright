CREATE TABLE public.ghl_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  contact_id text,
  sync_type text NOT NULL DEFAULT 'contact',
  status text NOT NULL,
  http_status integer,
  payload jsonb,
  response text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ghl_sync_log_created_at ON public.ghl_sync_log (created_at DESC);
CREATE INDEX idx_ghl_sync_log_email ON public.ghl_sync_log (email);
CREATE INDEX idx_ghl_sync_log_status ON public.ghl_sync_log (status);

GRANT SELECT ON public.ghl_sync_log TO authenticated;
GRANT ALL ON public.ghl_sync_log TO service_role;

ALTER TABLE public.ghl_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view GHL sync log"
ON public.ghl_sync_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Service role manages GHL sync log"
ON public.ghl_sync_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);