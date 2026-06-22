CREATE POLICY "Active admin users can view all admin users"
ON public.admin_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.admin_users me
    WHERE me.user_id = auth.uid() AND me.is_active = true
  )
);