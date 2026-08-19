CREATE INDEX IF NOT EXISTS idx_sales_leads_agent_unpaid_assigned_at
  ON public.sales_leads (assigned_to, assigned_at DESC NULLS LAST)
  WHERE is_paid = false;

CREATE INDEX IF NOT EXISTS idx_claims_submissions_email_lower
  ON public.claims_submissions (lower(btrim(email)))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_claims_submissions_reg_upper
  ON public.claims_submissions (upper(btrim(vehicle_registration)))
  WHERE vehicle_registration IS NOT NULL;