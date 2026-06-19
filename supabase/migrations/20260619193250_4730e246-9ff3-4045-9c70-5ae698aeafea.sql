
CREATE TABLE public.customer_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  customer_id uuid NULL,
  event_type text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  failure_reason text,
  ip_address text,
  user_agent text,
  triggered_by_admin_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cla_email_lower ON public.customer_login_attempts (lower(email));
CREATE INDEX idx_cla_customer_id ON public.customer_login_attempts (customer_id);
CREATE INDEX idx_cla_created_at ON public.customer_login_attempts (created_at DESC);

GRANT INSERT ON public.customer_login_attempts TO anon;
GRANT SELECT, INSERT ON public.customer_login_attempts TO authenticated;
GRANT ALL ON public.customer_login_attempts TO service_role;

ALTER TABLE public.customer_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a login attempt"
  ON public.customer_login_attempts
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view login attempts"
  ON public.customer_login_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Service role manages login attempts"
  ON public.customer_login_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
