
-- 1. Indexes that match the actual sort/filter patterns in useLeads.tsx
CREATE INDEX IF NOT EXISTS idx_sales_leads_created_at_id
  ON public.sales_leads (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_to_created_at
  ON public.sales_leads (assigned_to, created_at DESC)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_leads_unassigned_created_at
  ON public.sales_leads (created_at DESC)
  WHERE assigned_to IS NULL;

-- 2. Consolidate the 4 overlapping SELECT policies into 1, using (SELECT auth.uid())
--    so it is evaluated ONCE per query instead of once per row.
DROP POLICY IF EXISTS "Sales agents with all-leads permission can view all leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Sales leads can view all leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Sales users can view assigned leads" ON public.sales_leads;
DROP POLICY IF EXISTS "Sales users can view unassigned leads" ON public.sales_leads;

CREATE POLICY "Admin and sales can view leads"
ON public.sales_leads
FOR SELECT
TO authenticated
USING (
  public.is_admin((SELECT auth.uid()))
  OR public.is_sales_lead((SELECT auth.uid()))
  OR public.has_all_leads_permission((SELECT auth.uid()))
  OR assigned_to IN (
    SELECT id FROM public.admin_users
    WHERE user_id = (SELECT auth.uid()) AND is_active = true
  )
  OR (
    assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = (SELECT auth.uid()) AND is_active = true
    )
  )
);
