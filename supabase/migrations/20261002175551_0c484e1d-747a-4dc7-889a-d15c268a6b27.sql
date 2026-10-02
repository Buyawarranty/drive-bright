CREATE TABLE public.stripe_payment_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE,
  event_type text NOT NULL,
  stripe_object_id text,
  email text,
  vehicle_reg text,
  phone text,
  amount numeric,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stripe_payment_failures TO authenticated;
GRANT ALL ON public.stripe_payment_failures TO service_role;
ALTER TABLE public.stripe_payment_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view stripe failures" ON public.stripe_payment_failures
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid() AND COALESCE(au.is_active, true)));
CREATE INDEX idx_spf_email ON public.stripe_payment_failures (lower(email));
CREATE INDEX idx_spf_reg ON public.stripe_payment_failures (upper(vehicle_reg));