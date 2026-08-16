ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS sale_quoted_total numeric,
  ADD COLUMN IF NOT EXISTS sale_discount_amount numeric,
  ADD COLUMN IF NOT EXISTS sale_discount_pct numeric,
  ADD COLUMN IF NOT EXISTS sale_price_basis text;

COMMENT ON COLUMN public.customers.sale_quoted_total IS 'System-calculated total for the exact cover options at the moment of sale (Quotes & Orders / checkout). Source of truth for discount %.';
COMMENT ON COLUMN public.customers.sale_discount_pct IS 'Discount given at point of sale = (sale_quoted_total - final_amount) / sale_quoted_total * 100.';
COMMENT ON COLUMN public.customers.sale_price_basis IS 'Where the quoted figure came from: agent_quote, checkout, or backfill_original_amount.';

UPDATE public.customers c
SET sale_quoted_total = GREATEST(COALESCE(c.original_amount, 0), COALESCE(c.final_amount, 0)),
    sale_discount_amount = GREATEST(COALESCE(c.original_amount, 0), COALESCE(c.final_amount, 0)) - COALESCE(c.final_amount, 0),
    sale_discount_pct = CASE
      WHEN GREATEST(COALESCE(c.original_amount, 0), COALESCE(c.final_amount, 0)) > 0
      THEN ROUND(((GREATEST(COALESCE(c.original_amount, 0), COALESCE(c.final_amount, 0)) - COALESCE(c.final_amount, 0))
                  / GREATEST(COALESCE(c.original_amount, 0), COALESCE(c.final_amount, 0))) * 100, 1)
      ELSE 0
    END,
    sale_price_basis = 'backfill_original_amount'
WHERE c.sale_quoted_total IS NULL
  AND COALESCE(c.final_amount, 0) > 0
  AND COALESCE(c.signup_date, c.created_at) >= '2026-08-01'::timestamptz
  AND COALESCE(c.signup_date, c.created_at) < '2026-09-01'::timestamptz;