CREATE OR REPLACE FUNCTION public.get_cyber_security_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_tables integer;
  unprotected integer;
  no_policies integer;
  renewal_due integer;
  active_staff integer;
  gateway_due timestamptz;
  unsafe_paths integer;
  public_privileged integer;
  section_access jsonb;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.user_roles r
    JOIN public.admin_users a ON a.user_id = r.user_id
    WHERE r.user_id = p_user_id
      AND r.role::text IN ('admin','super_admin')
      AND a.is_active
      AND a.archived_at IS NULL
      AND (a.access_expires_at IS NULL OR a.access_expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Admin or super admin required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE NOT c.relrowsecurity),
         count(*) FILTER (WHERE c.relrowsecurity AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_policy p WHERE p.polrelid = c.oid))
    INTO total_tables, unprotected, no_policies
    FROM pg_catalog.pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';

  SELECT count(*),
         count(*) FILTER (WHERE s.user_id IS NULL OR s.forced_at IS NOT NULL OR s.changed_at + interval '3 months' <= now())
    INTO active_staff, renewal_due
    FROM public.admin_users a
    LEFT JOIN public.staff_password_renewals s ON s.user_id = a.user_id
   WHERE a.is_active AND a.archived_at IS NULL AND a.user_id IS NOT NULL
     AND (a.access_expires_at IS NULL OR a.access_expires_at > now());

  SELECT updated_at + interval '3 months' INTO gateway_due FROM public.login_gateway_settings WHERE id = true;

  SELECT count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM unnest(p.proconfig) x WHERE x LIKE 'search_path=%')),
         count(*) FILTER (WHERE pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE'))
    INTO unsafe_paths, public_privileged
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef;

  -- Classify each restricted admin area: "server enforced" means the database
  -- itself refuses the data to staff without the right role/permission;
  -- "menu only" means any signed-in staff member could still read it directly.
  -- A read rule that allows every active staff member (is_active_admin_user
  -- with no further restriction) counts as menu-only protection.
  SELECT jsonb_agg(jsonb_build_object(
           'section', s.section,
           'table_name', s.table_name,
           'server_enforced', NOT EXISTS (
             SELECT 1 FROM pg_catalog.pg_policy pol
             JOIN pg_catalog.pg_class c ON c.oid = pol.polrelid
             WHERE c.relnamespace = 'public'::regnamespace
               AND c.relname = s.table_name
               AND pol.polcmd IN ('r', '*')
               AND pg_get_expr(pol.polqual, pol.polrelid) LIKE 'is_active_admin_user%'
           )
         ) ORDER BY s.section)
    INTO section_access
    FROM (VALUES
      ('WhatsApp messages', 'whatsapp_conversations'),
      ('Claims', 'claims_submissions'),
      ('Marketing spend', 'marketing_spend'),
      ('Payouts', 'payouts'),
      ('Staff records', 'admin_users'),
      ('Customer records', 'customers'),
      ('Sales leads', 'sales_leads'),
      ('Commission records', 'commission_records')
    ) AS s(section, table_name);

  RETURN jsonb_build_object(
    'checked_at', now(),
    'tables', total_tables,
    'tables_without_rls', unprotected,
    'tables_without_policies', no_policies,
    'active_staff', active_staff,
    'staff_renewal_due', renewal_due,
    'gateway_due_at', gateway_due,
    'functions_without_pinned_path', unsafe_paths,
    'privileged_functions_anon_callable', public_privileged,
    'lockout_function_present', EXISTS(
      SELECT 1 FROM pg_catalog.pg_proc
      WHERE pronamespace = 'public'::regnamespace AND proname = 'check_login_lockout'),
    'renewal_hook_configured', EXISTS(
      SELECT 1 FROM pg_catalog.pg_db_role_setting s
      JOIN pg_catalog.pg_roles r ON r.oid = s.setrole
      WHERE r.rolname = 'authenticator'
        AND 'pgrst.db_pre_request=public.enforce_staff_password_renewal' = ANY(s.setconfig)),
    'section_access', section_access
  );
END;
$$;