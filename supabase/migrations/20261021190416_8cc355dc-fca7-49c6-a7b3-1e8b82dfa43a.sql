CREATE INDEX IF NOT EXISTS idx_sales_leads_handover_email ON public.sales_leads (lower(btrim(email)));
CREATE INDEX IF NOT EXISTS idx_sales_leads_handover_phone_tail ON public.sales_leads ((right(regexp_replace(COALESCE(phone,''),'\D','','g'),9)));
CREATE INDEX IF NOT EXISTS idx_customers_handover_email ON public.customers (lower(trim(email)));
CREATE INDEX IF NOT EXISTS idx_customers_handover_reg ON public.customers ((upper(regexp_replace(COALESCE(registration_plate,''),'\s+','','g'))));
ANALYZE public.sales_leads;
ANALYZE public.customers;