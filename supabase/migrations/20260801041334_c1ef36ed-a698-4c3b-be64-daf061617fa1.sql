CREATE POLICY "Management can update admin user discount settings"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (public.is_management(auth.uid()))
WITH CHECK (public.is_management(auth.uid()));