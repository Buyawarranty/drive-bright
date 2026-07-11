
CREATE TABLE public.worldpay_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sales_lead_id UUID NULL,
  customer_id UUID NULL,
  admin_user_id UUID NULL,
  flow TEXT NOT NULL CHECK (flow IN ('moto','link')),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','live')),
  amount_pence INTEGER NOT NULL CHECK (amount_pence > 0),
  currency TEXT NOT NULL DEFAULT 'GBP',
  description TEXT NULL,
  customer_email TEXT NULL,
  customer_phone TEXT NULL,
  worldpay_payment_id TEXT NULL,
  worldpay_link_id TEXT NULL,
  worldpay_link_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','authorised','captured','failed','cancelled','refunded')),
  last_event TEXT NULL,
  last_error TEXT NULL,
  raw_response JSONB NULL
);

GRANT SELECT, INSERT, UPDATE ON public.worldpay_transactions TO authenticated;
GRANT ALL ON public.worldpay_transactions TO service_role;

ALTER TABLE public.worldpay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view all worldpay transactions"
  ON public.worldpay_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Management can insert worldpay transactions"
  ON public.worldpay_transactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_sales(auth.uid()));

CREATE POLICY "Management can update worldpay transactions"
  ON public.worldpay_transactions FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_sales(auth.uid()))
  WITH CHECK (public.is_admin_or_sales(auth.uid()));

CREATE TRIGGER update_worldpay_transactions_updated_at
  BEFORE UPDATE ON public.worldpay_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_worldpay_tx_lead ON public.worldpay_transactions(sales_lead_id);
CREATE INDEX idx_worldpay_tx_customer ON public.worldpay_transactions(customer_id);
CREATE INDEX idx_worldpay_tx_status ON public.worldpay_transactions(status);
CREATE INDEX idx_worldpay_tx_payment_id ON public.worldpay_transactions(worldpay_payment_id);
CREATE INDEX idx_worldpay_tx_link_id ON public.worldpay_transactions(worldpay_link_id);
