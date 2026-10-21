REVOKE ALL ON public.staff_password_renewals FROM anon,authenticated;
GRANT SELECT ON public.staff_password_renewals TO authenticated;
GRANT ALL ON public.staff_password_renewals TO service_role;