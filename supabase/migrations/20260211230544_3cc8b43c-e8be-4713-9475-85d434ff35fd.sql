
-- Allow Sales Leads to view all agent caps when distribution access is enabled
CREATE POLICY "Sales leads can view all caps when access granted"
ON public.agent_distribution_caps
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

-- Allow Sales Leads to update agent caps when distribution access is enabled
CREATE POLICY "Sales leads can update caps when access granted"
ON public.agent_distribution_caps
FOR UPDATE
TO authenticated
USING (
  public.is_sales_lead(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE config_key = 'sales_lead_distribution_access'
    AND config_value = true
  )
)
WITH CHECK (
  public.is_sales_lead(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE config_key = 'sales_lead_distribution_access'
    AND config_value = true
  )
);
