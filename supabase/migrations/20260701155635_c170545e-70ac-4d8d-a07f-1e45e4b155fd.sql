
ALTER TABLE public.claims_submissions
  ADD COLUMN IF NOT EXISTS claimed_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC;

-- Backfill claimed_amount from existing payment_amount so nothing looks empty.
UPDATE public.claims_submissions
   SET claimed_amount = payment_amount
 WHERE claimed_amount IS NULL AND payment_amount IS NOT NULL;
