-- Read-only production regression checks: no handover or customer data writes.
SELECT
  (SELECT count(*) = 3 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('offboard_agent_handover', 'restore_agent_offboarding_backup', 'create_agent_offboarding_backup')
     AND p.proconfig @> ARRAY['statement_timeout=180s']) AS bounded_backup_timeouts,
  (SELECT count(*) = 4 FROM pg_indexes WHERE schemaname = 'public'
   AND indexname IN ('idx_sales_leads_handover_email', 'idx_sales_leads_handover_phone_tail',
                    'idx_customers_handover_email', 'idx_customers_handover_reg')) AS indexed_owner_lookups,
  (SELECT bool_and(p.prosecdef AND p.proconfig @> ARRAY['search_path=public'])
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('offboard_agent_handover', 'restore_agent_offboarding_backup', 'create_agent_offboarding_backup')) AS existing_function_security_preserved;