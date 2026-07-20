ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS ni_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ni_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ni_verified_by uuid;

CREATE INDEX IF NOT EXISTS idx_customers_ni_unverified
  ON public.customers (registration_plate)
  WHERE ni_verified = false AND is_deleted = false;