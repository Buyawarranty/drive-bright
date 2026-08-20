-- Agent view: "my leads + unassigned", newest first. The unassigned half of that
-- OR previously fell back to filtering the whole table.
CREATE INDEX IF NOT EXISTS idx_sales_leads_unassigned_created_id
  ON public.sales_leads (created_at DESC, id DESC)
  WHERE assigned_to IS NULL;

-- Date-window views filter on last_resubmitted_at as well as created_at.
CREATE INDEX IF NOT EXISTS idx_sales_leads_last_resubmitted_at
  ON public.sales_leads (last_resubmitted_at DESC)
  WHERE last_resubmitted_at IS NOT NULL;

-- Orphaned/lost lead recovery pages abandoned_carts by step + created_at.
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_step_created
  ON public.abandoned_carts (step_abandoned, created_at DESC);