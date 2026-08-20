CREATE INDEX IF NOT EXISTS idx_live_quotes_status_paid_at ON public.live_quotes (status, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_quotes_email_reg_created ON public.live_quotes (customer_email, vehicle_reg, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_email_lower_all ON public.customers (lower(email));
CREATE INDEX IF NOT EXISTS idx_customer_policies_policy_number_lookup ON public.customer_policies (policy_number);
ANALYZE public.live_quotes;