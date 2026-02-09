-- Allow sales_lead users to view all admin_users (for agent overview)
CREATE POLICY "Sales leads can view all admin users"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users au
    WHERE au.user_id = auth.uid()
    AND au.role = 'sales_lead'
    AND au.is_active = true
  )
);