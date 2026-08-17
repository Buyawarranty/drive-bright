CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_paid_assigned_at
  ON public.sales_leads (assigned_to, is_paid, assigned_at DESC NULLS LAST);
ANALYZE public.sales_leads;