
CREATE TABLE public.step2_submission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text,
  email text,
  phone text,
  first_name text,
  vehicle_reg text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year text,
  mileage text,
  attempt_status text NOT NULL DEFAULT 'attempted',
  error_message text,
  error_source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_step2_attempts_created_at ON public.step2_submission_attempts(created_at DESC);

ALTER TABLE public.step2_submission_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts on step2_submission_attempts"
  ON public.step2_submission_attempts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow admin reads on step2_submission_attempts"
  ON public.step2_submission_attempts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      INNER JOIN public.user_roles ur ON ur.user_id = au.user_id
      WHERE au.user_id = auth.uid() AND au.is_active = true
    )
  );
