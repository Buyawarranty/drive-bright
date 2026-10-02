CREATE TABLE public.payment_button_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT NOT NULL,
  email TEXT,
  vehicle_reg TEXT,
  amount NUMERIC,
  page_path TEXT,
  gclid TEXT,
  fbclid TEXT,
  tracking_session_id TEXT
);
GRANT INSERT ON public.payment_button_clicks TO anon;
GRANT SELECT ON public.payment_button_clicks TO authenticated;
GRANT ALL ON public.payment_button_clicks TO service_role;
ALTER TABLE public.payment_button_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can log a payment button click" ON public.payment_button_clicks FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can view payment button clicks" ON public.payment_button_clicks FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_payment_button_clicks_created_at ON public.payment_button_clicks (created_at);
CREATE INDEX idx_payment_button_clicks_method ON public.payment_button_clicks (payment_method, created_at);