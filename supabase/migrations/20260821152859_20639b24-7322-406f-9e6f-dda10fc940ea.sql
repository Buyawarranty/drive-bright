ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_verified_by uuid,
  ADD COLUMN IF NOT EXISTS payment_verification_source text,
  ADD COLUMN IF NOT EXISTS payment_verification_ref text,
  ADD COLUMN IF NOT EXISTS payment_verification_note text,
  ADD COLUMN IF NOT EXISTS payment_verification_status text NOT NULL DEFAULT 'pending';

UPDATE public.customers
   SET payment_verification_status = 'verified'
 WHERE payment_verified IS TRUE AND payment_verification_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_customers_payment_verification_status
  ON public.customers (payment_verification_status, signup_date DESC);