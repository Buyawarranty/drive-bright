DO $do$
DECLARE
  v_def text;
  v_new text;
  v_needle text := $n$          AND au.archived_at IS NULL
          AND sl.status NOT IN ('lost','fake_lead','converted','do_not_contact','archived')$n$;
  v_repl text := $r$          AND au.archived_at IS NULL
          AND au.role IN ('sales','sales_lead')
          -- Sticky ownership must respect the agent's ON/OFF switch: a switched-off
          -- (paused) or Open Pool agent never receives new leads automatically.
          AND EXISTS (
            SELECT 1 FROM public.agent_distribution_caps adc
            WHERE adc.admin_user_id = sl.assigned_to
              AND COALESCE(adc.paused, false) = false
              AND COALESCE(adc.assignment_mode, 'round_robin') <> 'open_pool'
          )
          AND public.agent_works_new_leads(sl.assigned_to)
          AND sl.status NOT IN ('lost','fake_lead','converted','do_not_contact','archived')$r$;
BEGIN
  v_def := pg_get_functiondef('public.auto_assign_lead_round_robin()'::regprocedure);
  IF position(v_needle in v_def) = 0 THEN
    RAISE EXCEPTION 'sticky-owner block not found in auto_assign_lead_round_robin';
  END IF;
  v_new := replace(v_def, v_needle, v_repl);
  EXECUTE v_new;
END
$do$;