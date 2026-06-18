ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS recovery_worked_at TIMESTAMPTZ;
ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS recovery_outcome TEXT;
CREATE INDEX IF NOT EXISTS idx_sales_leads_recovery_worked_at ON public.sales_leads(recovery_worked_at);
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at_status ON public.sales_leads(created_at, status);