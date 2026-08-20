ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS save_cancellation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS save_reward_amount numeric,
  ADD COLUMN IF NOT EXISTS save_reason text,
  ADD COLUMN IF NOT EXISTS save_requested_by uuid,
  ADD COLUMN IF NOT EXISTS save_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS save_source_customer_id uuid;

CREATE INDEX IF NOT EXISTS idx_sales_leads_save_cancellation
  ON public.sales_leads (save_cancellation, created_at DESC)
  WHERE save_cancellation = true;