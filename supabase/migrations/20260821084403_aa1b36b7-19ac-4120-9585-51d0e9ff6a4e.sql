-- Permanently fix per-row auth re-evaluation in RLS policies.
-- Rewrites every public-schema policy expression so auth.uid()/auth.jwt()/auth.role()
-- are evaluated ONCE per query (as an InitPlan) instead of once per row.
-- Roles, commands and access semantics are preserved exactly.
DO $$
DECLARE
  p record;
  q text;
  c text;
  new_q text;
  new_c text;
  stmt text;
  fixed int := 0;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, qual, with_check
      FROM pg_policies
     WHERE schemaname = 'public'
  LOOP
    q := p.qual;
    c := p.with_check;
    new_q := q;
    new_c := c;

    IF new_q IS NOT NULL THEN
      new_q := replace(new_q, '( SELECT auth.uid() AS uid)', '@@AUTHUID@@');
      new_q := replace(new_q, '( SELECT auth.jwt() AS jwt)', '@@AUTHJWT@@');
      new_q := replace(new_q, '( SELECT auth.role() AS role)', '@@AUTHROLE@@');
      new_q := replace(new_q, 'auth.uid()', '@@AUTHUID@@');
      new_q := replace(new_q, 'auth.jwt()', '@@AUTHJWT@@');
      new_q := replace(new_q, 'auth.role()', '@@AUTHROLE@@');
      new_q := replace(new_q, '@@AUTHUID@@', '( SELECT auth.uid() )');
      new_q := replace(new_q, '@@AUTHJWT@@', '( SELECT auth.jwt() )');
      new_q := replace(new_q, '@@AUTHROLE@@', '( SELECT auth.role() )');
    END IF;

    IF new_c IS NOT NULL THEN
      new_c := replace(new_c, '( SELECT auth.uid() AS uid)', '@@AUTHUID@@');
      new_c := replace(new_c, '( SELECT auth.jwt() AS jwt)', '@@AUTHJWT@@');
      new_c := replace(new_c, '( SELECT auth.role() AS role)', '@@AUTHROLE@@');
      new_c := replace(new_c, 'auth.uid()', '@@AUTHUID@@');
      new_c := replace(new_c, 'auth.jwt()', '@@AUTHJWT@@');
      new_c := replace(new_c, 'auth.role()', '@@AUTHROLE@@');
      new_c := replace(new_c, '@@AUTHUID@@', '( SELECT auth.uid() )');
      new_c := replace(new_c, '@@AUTHJWT@@', '( SELECT auth.jwt() )');
      new_c := replace(new_c, '@@AUTHROLE@@', '( SELECT auth.role() )');
    END IF;

    IF (new_q IS DISTINCT FROM q) OR (new_c IS DISTINCT FROM c) THEN
      stmt := format('ALTER POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
      IF new_q IS NOT NULL THEN
        stmt := stmt || format(' USING (%s)', new_q);
      END IF;
      IF new_c IS NOT NULL THEN
        stmt := stmt || format(' WITH CHECK (%s)', new_c);
      END IF;
      BEGIN
        EXECUTE stmt;
        fixed := fixed + 1;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Skipped policy %.% (%): %', p.tablename, p.policyname, SQLERRM, stmt;
      END;
    END IF;
  END LOOP;
  RAISE NOTICE 'Optimised % policies', fixed;
END;
$$;

-- Lead-history lookups (New Leads "changed" badges) filter by lead_id only.
CREATE INDEX IF NOT EXISTS idx_changelog_lead_id_only
  ON public.sales_leads_changelog (lead_id);

-- Keep the biggest hot tables' statistics fresh for the planner.
ANALYZE public.sales_leads;
ANALYZE public.sales_leads_changelog;
ANALYZE public.lead_quick_notes;
ANALYZE public.lead_call_logs;
