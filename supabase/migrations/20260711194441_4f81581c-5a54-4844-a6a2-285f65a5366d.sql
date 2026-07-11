
CREATE TABLE IF NOT EXISTS public.payment_assist_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_user_id UUID,
  sales_lead_id UUID,
  customer_email TEXT,
  customer_phone TEXT,
  customer_first_name TEXT,
  customer_last_name TEXT,
  amount_pence INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  description TEXT,
  reference TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  provider_application_id TEXT,
  application_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_event TEXT,
  last_error TEXT,
  raw_response JSONB
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_assist_transactions TO authenticated;
GRANT ALL ON public.payment_assist_transactions TO service_role;

ALTER TABLE public.payment_assist_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/sales can view payment assist transactions"
  ON public.payment_assist_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Admins/sales can insert payment assist transactions"
  ON public.payment_assist_transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Admins/sales can update payment assist transactions"
  ON public.payment_assist_transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE TRIGGER trg_payment_assist_updated_at
  BEFORE UPDATE ON public.payment_assist_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payment_assist_lead ON public.payment_assist_transactions(sales_lead_id);
CREATE INDEX IF NOT EXISTS idx_payment_assist_status ON public.payment_assist_transactions(status);
