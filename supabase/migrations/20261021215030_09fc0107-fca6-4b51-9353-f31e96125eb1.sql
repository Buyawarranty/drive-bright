GRANT SELECT ON public.staff_password_renewals TO authenticated;
CREATE POLICY "Staff read own renewal date" ON public.staff_password_renewals FOR SELECT TO authenticated USING(user_id=auth.uid());
ALTER FUNCTION public.enforce_staff_password_renewal() SECURITY INVOKER;