
-- Retry grants with explicit schema
GRANT INSERT, SELECT ON TABLE public.sales_leads TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.sales_leads TO authenticated;
