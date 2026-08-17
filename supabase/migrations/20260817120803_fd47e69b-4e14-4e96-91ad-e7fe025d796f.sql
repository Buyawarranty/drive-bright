CREATE INDEX IF NOT EXISTS idx_sales_leads_vehicle_reg_upper
  ON public.sales_leads (upper(replace(vehicle_reg, ' ', '')));