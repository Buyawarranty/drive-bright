CREATE POLICY "Sales leads can delete caps when access granted"
ON public.agent_distribution_caps
FOR DELETE
TO authenticated
USING (
  is_sales_lead(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.admin_config
    WHERE config_key = 'sales_lead_distribution_access'
      AND config_value = true
  )
);