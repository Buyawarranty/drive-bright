ALTER TABLE public.sales_targets
  ADD COLUMN IF NOT EXISTS revenue_target numeric NOT NULL DEFAULT 35000;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_targets TO authenticated;
GRANT ALL ON public.sales_targets TO service_role;

DROP POLICY IF EXISTS "Agents can view their own sales target" ON public.sales_targets;
CREATE POLICY "Agents can view their own sales target"
ON public.sales_targets
FOR SELECT
TO authenticated
USING (
  admin_user_id IN (
    SELECT id FROM public.admin_users WHERE user_id = auth.uid()
  )
);