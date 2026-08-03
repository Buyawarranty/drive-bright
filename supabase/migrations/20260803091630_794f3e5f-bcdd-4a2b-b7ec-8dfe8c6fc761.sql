-- Sales agents may read changelog rows where they are the previous or new owner
CREATE POLICY "Agents can read own assignment changelog"
ON public.sales_leads_changelog
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND (
        au.id = sales_leads_changelog.old_assigned_to
        OR au.id = sales_leads_changelog.new_assigned_to
      )
  )
);

-- Management roles get full visibility of the changelog
CREATE POLICY "Management can read all assignment changelog"
ON public.sales_leads_changelog
FOR SELECT
TO authenticated
USING (public.is_management(auth.uid()));

-- Sales agents may read audit rows for assignments made to them
CREATE POLICY "Agents can read own assignment audit"
ON public.lead_assignment_audit
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
      AND au.is_active = true
      AND au.id = lead_assignment_audit.assigned_to_id
  )
);

-- Management + sales leads get full visibility of the assignment audit
CREATE POLICY "Management can read all assignment audit"
ON public.lead_assignment_audit
FOR SELECT
TO authenticated
USING (public.is_management(auth.uid()) OR public.is_sales_lead(auth.uid()));