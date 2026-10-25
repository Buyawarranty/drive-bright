CREATE TABLE public.staff_export_grants (
 admin_user_id uuid PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
 granted_by uuid NOT NULL DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,DELETE ON public.staff_export_grants TO authenticated;
GRANT ALL ON public.staff_export_grants TO service_role;
ALTER TABLE public.staff_export_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own export grant or administer grants" ON public.staff_export_grants FOR SELECT TO authenticated USING (admin_user_id=public.current_admin_user_id() OR (public.is_active_admin_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin'))));
CREATE POLICY "Only admins grant exports" ON public.staff_export_grants FOR INSERT TO authenticated WITH CHECK (granted_by=auth.uid() AND public.is_active_admin_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin')));
CREATE POLICY "Only admins revoke exports" ON public.staff_export_grants FOR DELETE TO authenticated USING (public.is_active_admin_user(auth.uid()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin')));
CREATE TRIGGER staff_export_grants_updated BEFORE UPDATE ON public.staff_export_grants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE FUNCTION public.can_export_customer_data() RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT public.is_active_admin_user(auth.uid()) AND (EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin')) OR EXISTS(SELECT 1 FROM public.staff_export_grants WHERE admin_user_id=public.current_admin_user_id()));
$$;
REVOKE ALL ON FUNCTION public.can_export_customer_data() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_export_customer_data() TO authenticated,service_role;