
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS pool_status TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_pool_status_check') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_pool_status_check
      CHECK (pool_status IS NULL OR pool_status IN (
        'new',
        'calling_locked',
        'contacted',
        'callback_booked',
        'quote_sent',
        'policy_sent',
        'payment_link_sent',
        'negotiating',
        'converted',
        'lost',
        'invalid'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_leads_pool_status
  ON public.sales_leads(pool_status) WHERE pool_status IS NOT NULL;
