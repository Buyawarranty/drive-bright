CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_sales_leads_trgm_email ON public.sales_leads USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_leads_trgm_phone ON public.sales_leads USING gin (phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_leads_trgm_first_name ON public.sales_leads USING gin (first_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_leads_trgm_last_name ON public.sales_leads USING gin (last_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sales_leads_trgm_vehicle_reg ON public.sales_leads USING gin (vehicle_reg gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_trgm_email ON public.customers USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_reg ON public.customers USING gin (registration_plate gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_name ON public.customers USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_customers_trgm_phone ON public.customers USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_claims_trgm_email ON public.claims_submissions USING gin (email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_claims_trgm_reg ON public.claims_submissions USING gin (vehicle_registration gin_trgm_ops);

ANALYZE public.sales_leads;
ANALYZE public.customers;