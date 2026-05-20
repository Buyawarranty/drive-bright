
CREATE POLICY "Sales leads can manage sales targets"
  ON public.sales_targets FOR ALL
  USING (is_sales_lead(auth.uid()))
  WITH CHECK (is_sales_lead(auth.uid()));
