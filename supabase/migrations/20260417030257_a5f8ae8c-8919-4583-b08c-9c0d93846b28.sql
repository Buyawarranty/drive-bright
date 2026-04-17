-- Dealer flat discount percentage (0-50%)
ALTER TABLE public.dealers
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) NOT NULL DEFAULT 0
  CHECK (discount_pct >= 0 AND discount_pct <= 50);

-- Link customers (orders) to dealers when purchased through dealer portal
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dealer_id uuid REFERENCES public.dealers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_dealer_id
  ON public.customers(dealer_id)
  WHERE dealer_id IS NOT NULL;

-- RLS: dealers can view their own orders in customers table
DROP POLICY IF EXISTS "Dealers view own customer orders" ON public.customers;
CREATE POLICY "Dealers view own customer orders"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    dealer_id IS NOT NULL
    AND dealer_id IN (SELECT id FROM public.dealers WHERE user_id = auth.uid())
  );