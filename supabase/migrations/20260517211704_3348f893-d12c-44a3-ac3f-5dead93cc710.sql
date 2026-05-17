
CREATE TABLE public.checkout_struggle_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_key TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  vehicle_reg TEXT,
  device_type TEXT,
  payment_method TEXT,
  plan_name TEXT,
  amount NUMERIC,
  details JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_key, signal_type)
);

CREATE INDEX idx_csa_status_created ON public.checkout_struggle_alerts (status, created_at DESC);
CREATE INDEX idx_csa_email ON public.checkout_struggle_alerts (customer_email);

ALTER TABLE public.checkout_struggle_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert struggle alerts"
ON public.checkout_struggle_alerts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view struggle alerts"
ON public.checkout_struggle_alerts
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update struggle alerts"
ON public.checkout_struggle_alerts
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE TRIGGER set_csa_updated_at
BEFORE UPDATE ON public.checkout_struggle_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.checkout_struggle_alerts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.checkout_struggle_alerts;

CREATE OR REPLACE FUNCTION public.auto_resolve_checkout_struggle_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE public.checkout_struggle_alerts
    SET status = 'resolved', resolved_at = now()
    WHERE status IN ('active', 'acknowledged')
      AND (
        lower(customer_email) = lower(NEW.email)
        OR (NEW.registration_plate IS NOT NULL
            AND vehicle_reg IS NOT NULL
            AND upper(regexp_replace(vehicle_reg, '\s', '', 'g')) =
                upper(regexp_replace(NEW.registration_plate, '\s', '', 'g')))
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_resolve_struggle_alerts
AFTER INSERT ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.auto_resolve_checkout_struggle_alerts();
