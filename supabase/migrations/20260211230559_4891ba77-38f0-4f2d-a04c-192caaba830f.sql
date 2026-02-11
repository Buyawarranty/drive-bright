
-- Allow Sales Leads to view distribution settings when access is granted
CREATE POLICY "Sales leads can view settings when access granted"
ON public.lead_distribution_settings
FOR SELECT
TO authenticated
USING (
  public.is_sales_lead(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE config_key = 'sales_lead_distribution_access'
    AND config_value = true
  )
);
