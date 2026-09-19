ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deferred_status TEXT,
  ADD COLUMN IF NOT EXISTS deferred_start_date DATE,
  ADD COLUMN IF NOT EXISTS deferred_payment_due_date DATE,
  ADD COLUMN IF NOT EXISTS deferred_created_by UUID,
  ADD COLUMN IF NOT EXISTS deferred_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deferred_last_chased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deferred_chase_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deferred_payment_link TEXT,
  ADD COLUMN IF NOT EXISTS deferred_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deferred_reminders_sent JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_customers_deferred_status
  ON public.customers (deferred_status, deferred_payment_due_date)
  WHERE deferred_status IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_deferred_payment_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deferred_status = 'pending_payment' THEN
    IF NEW.deferred_start_date IS NULL OR NEW.deferred_payment_due_date IS NULL THEN
      RAISE EXCEPTION 'A pending payment order needs both a warranty start date and a payment due date';
    END IF;
    IF NEW.deferred_payment_due_date > NEW.deferred_start_date THEN
      RAISE EXCEPTION 'Payment must be due on or before the warranty start date';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_deferred_payment_dates ON public.customers;
CREATE TRIGGER trg_validate_deferred_payment_dates
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.validate_deferred_payment_dates();