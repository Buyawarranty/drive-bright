ALTER TABLE public.customer_part_payment_plans
  ADD COLUMN IF NOT EXISTS reminder_note text,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_dismissed_until date;