CREATE POLICY "Management can view all sales targets"
ON public.sales_targets FOR SELECT TO authenticated
USING (public.is_management(auth.uid()));

CREATE POLICY "Management can insert sales targets"
ON public.sales_targets FOR INSERT TO authenticated
WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can update sales targets"
ON public.sales_targets FOR UPDATE TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));

CREATE POLICY "Management can delete sales targets"
ON public.sales_targets FOR DELETE TO authenticated
USING (public.is_management(auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;