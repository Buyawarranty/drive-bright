ALTER TABLE public.staff_export_grants
  ADD COLUMN can_export_new_leads boolean NOT NULL DEFAULT false,
  ADD COLUMN can_export_customers boolean NOT NULL DEFAULT false,
  ADD COLUMN can_see_lead_source boolean NOT NULL DEFAULT false;

-- Existing grant rows meant "all exports": preserve that behaviour.
UPDATE public.staff_export_grants SET can_export_new_leads = true, can_export_customers = true;

CREATE OR REPLACE FUNCTION public.can_export_new_leads()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_active_admin_user(auth.uid()) AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin'))
    OR EXISTS(SELECT 1 FROM public.staff_export_grants WHERE admin_user_id = public.current_admin_user_id() AND can_export_new_leads)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_export_customers()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_active_admin_user(auth.uid()) AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin'))
    OR EXISTS(SELECT 1 FROM public.staff_export_grants WHERE admin_user_id = public.current_admin_user_id() AND can_export_customers)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_lead_source()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.is_active_admin_user(auth.uid()) AND (
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text IN ('admin','super_admin'))
    OR EXISTS(SELECT 1 FROM public.staff_export_grants WHERE admin_user_id = public.current_admin_user_id() AND can_see_lead_source)
  );
$$;

-- One round trip for the permissions panel and hooks.
CREATE OR REPLACE FUNCTION public.get_my_export_permissions()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'can_export_new_leads', public.can_export_new_leads(),
    'can_export_customers', public.can_export_customers(),
    'can_see_lead_source', public.can_see_lead_source()
  );
$$;

-- Legacy combined check: true when either export scope is granted, so other
-- sections (claims, cancellations, refunds, abandoned carts, email hub) keep
-- working for existing grantees.
CREATE OR REPLACE FUNCTION public.can_export_customer_data()
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT public.can_export_new_leads() OR public.can_export_customers();
$$;

REVOKE ALL ON FUNCTION public.can_export_new_leads() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_export_customers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_see_lead_source() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_export_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_export_customer_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_export_new_leads() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_export_customers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_lead_source() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_export_permissions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_export_customer_data() TO authenticated, service_role;