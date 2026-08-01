ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS price_match_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_match_competitor text,
  ADD COLUMN IF NOT EXISTS price_match_competitor_price numeric,
  ADD COLUMN IF NOT EXISTS price_match_our_price numeric;

CREATE INDEX IF NOT EXISTS idx_customers_price_match_applied
  ON public.customers (price_match_applied)
  WHERE price_match_applied = true;