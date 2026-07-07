
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS queue TEXT,
  ADD COLUMN IF NOT EXISTS call_outcome TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS auto_tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS locked_by UUID,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_agent UUID,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sales_leads_queue_check') THEN
    ALTER TABLE public.sales_leads
      ADD CONSTRAINT sales_leads_queue_check
      CHECK (queue IS NULL OR queue IN (
        'live_open_pool','overnight_queue','morning_call_queue','retry_queue',
        'callback_queue','owned_by_agent','nurture_queue','closed'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_leads_queue          ON public.sales_leads(queue)          WHERE queue IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_leads_locked_by      ON public.sales_leads(locked_by)      WHERE locked_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_leads_owner_agent    ON public.sales_leads(owner_agent)    WHERE owner_agent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_leads_next_action_at ON public.sales_leads(next_action_at) WHERE next_action_at IS NOT NULL;
