-- Fix agent_daily_targets policies to use SECURITY DEFINER functions
DROP POLICY IF EXISTS "Admins and sales leads can view all targets" ON public.agent_daily_targets;
DROP POLICY IF EXISTS "Admins and sales leads can update targets" ON public.agent_daily_targets;
DROP POLICY IF EXISTS "Admins and sales leads can insert targets" ON public.agent_daily_targets;
DROP POLICY IF EXISTS "Agents can view own targets" ON public.agent_daily_targets;

CREATE POLICY "Admins and sales leads can view all targets"
ON public.agent_daily_targets FOR SELECT
USING (is_admin(auth.uid()) OR is_sales_lead(auth.uid()));

CREATE POLICY "Admins and sales leads can update targets"
ON public.agent_daily_targets FOR UPDATE
USING (is_admin(auth.uid()) OR is_sales_lead(auth.uid()));

CREATE POLICY "Admins and sales leads can insert targets"
ON public.agent_daily_targets FOR INSERT
WITH CHECK (is_admin(auth.uid()) OR is_sales_lead(auth.uid()));

CREATE POLICY "Agents can view own targets"
ON public.agent_daily_targets FOR SELECT
USING (is_admin_or_sales(auth.uid()));