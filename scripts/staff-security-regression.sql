-- Read-only regression checks against the deployed security rules.
-- Each failed rule raises division_by_zero instead of quietly returning false.
SELECT 'Payment clicks require active staff' AS rule,
  1 / CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_button_clicks'
      AND cmd='SELECT' AND qual LIKE '%is_active_admin_user%'
  ) AND NOT public.is_active_admin_user('00000000-0000-0000-0000-000000000000'::uuid)
  THEN 1 ELSE 0 END AS passed;

SELECT 'Staff cannot forge lead or allocation audit entries' AS rule,
  1 / CASE WHEN NOT has_table_privilege('authenticated','public.sales_leads_changelog','INSERT')
    AND NOT has_table_privilege('authenticated','public.shark_tank_audit','INSERT')
    AND has_table_privilege('service_role','public.sales_leads_changelog','INSERT')
    AND has_table_privilege('service_role','public.shark_tank_audit','INSERT')
    AND NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND (p.prosrc ILIKE '%insert into%sales_leads_changelog%' OR p.prosrc ILIKE '%insert into%shark_tank_audit%')
        AND NOT p.prosecdef
    ) THEN 1 ELSE 0 END AS passed;

SELECT 'Phone events require the callers own active agent ID' AS rule,
  1 / CASE WHEN EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='phone_events'
      AND cmd='INSERT' AND with_check LIKE '%agent_id = ANY%'
      AND with_check LIKE '%au.user_id%auth.uid()%'
      AND with_check LIKE '%au.is_active = true%'
  ) THEN 1 ELSE 0 END AS passed;

SELECT 'Staff archiving rejects a missing management role' AS rule,
  1 / CASE WHEN EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='archive_admin_user_preserve_sales'
      AND p.prosrc LIKE '%v_caller_role IS NULL OR v_caller_role NOT IN (''super_admin'', ''admin'', ''sales_manager'')%'
  ) THEN 1 ELSE 0 END AS passed;

SELECT 'Public checkout click logging remains enabled' AS rule,
  1 / CASE WHEN has_table_privilege('anon','public.payment_button_clicks','INSERT')
    AND has_table_privilege('authenticated','public.payment_button_clicks','INSERT')
    AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_button_clicks'
      AND cmd='INSERT' AND with_check='true') THEN 1 ELSE 0 END AS passed;