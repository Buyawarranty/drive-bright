DROP POLICY "Admins can view page analytics" ON public.page_views;

CREATE POLICY "Admins can view page analytics"
ON public.page_views
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'super_admin', 'dev_tester')
  )
);