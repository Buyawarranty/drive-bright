ALTER TABLE public.claim_appeals
  ADD COLUMN IF NOT EXISTS independent_reviewer text,
  ADD COLUMN IF NOT EXISTS reviewer_url text,
  ADD COLUMN IF NOT EXISTS appeal_fee numeric,
  ADD COLUMN IF NOT EXISTS payment_link text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_notified boolean NOT NULL DEFAULT false;