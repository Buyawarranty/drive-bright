GRANT UPDATE ON public.staff_export_grants TO authenticated;

CREATE POLICY "Only admins update export grants" ON public.staff_export_grants
FOR UPDATE TO authenticated
USING (public.is_active_admin_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin')))
WITH CHECK (public.is_active_admin_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin')));