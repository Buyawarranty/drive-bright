CREATE INDEX IF NOT EXISTS idx_sales_leads_vehicle_reg ON public.sales_leads (vehicle_reg);
DROP INDEX IF EXISTS public.idx_sales_leads_vehicle_reg_upper;