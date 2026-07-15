CREATE OR REPLACE FUNCTION public.open_pool_drain_morning_queue(_max_leads integer DEFAULT 500)
 RETURNS TABLE(assigned_rr integer, assigned_pool integer, skipped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _caller_role text;
  _lead RECORD;
  _agent uuid;
  _cap jsonb;
  _next_slot text := 'rr';
  _rr_count int := 0;
  _pool_count int := 0;
  _skipped int := 0;
  _uk_dow int;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT role INTO _caller_role
      FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = true
     LIMIT 1;
    IF _caller_role IS NULL OR _caller_role NOT IN ('admin','super_admin','sales_manager') THEN
      RAISE EXCEPTION 'Not authorized to drain morning queue';
    END IF;
  END IF;

  _uk_dow := EXTRACT(DOW FROM (now() AT TIME ZONE 'Europe/London'))::int;
  IF auth.uid() IS NULL AND _uk_dow IN (0, 6) THEN
    assigned_rr := 0; assigned_pool := 0; skipped := 0;
    RETURN NEXT; RETURN;
  END IF;

  PERFORM public.reset_daily_caps();

  FOR _lead IN
    SELECT id, lead_source
      FROM public.sales_leads
     WHERE queue = 'morning_call_queue'
       AND assigned_to IS NULL
       AND owner_agent IS NULL
       AND status NOT IN ('lost','converted','fake_lead')
       AND (pool_status IS NULL OR pool_status IN ('new','callback_booked','contacted'))
       AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
     ORDER BY COALESCE(priority_score, 0) DESC, created_at ASC
     LIMIT _max_leads
     FOR UPDATE SKIP LOCKED
  LOOP
    _agent := NULL;

    IF _next_slot = 'rr' THEN
      _agent := public.pick_agent_for_distribution(NULL, COALESCE(_lead.lead_source::text,'unknown'));

      IF _agent IS NOT NULL THEN
        _cap := public.enforce_agent_cap(_agent, false);
        IF NOT (_cap->>'ok')::boolean THEN _agent := NULL; END IF;
      END IF;

      IF _agent IS NOT NULL THEN
        UPDATE public.sales_leads
           SET assigned_to    = _agent,
               owner_agent    = _agent,
               assigned_at    = COALESCE(assigned_at, now()),
               queue          = 'owned_by_agent',
               pool_status    = 'new',
               last_action_at = now(),
               updated_at     = now()
         WHERE id = _lead.id;

        UPDATE public.agent_distribution_caps
           SET assigned_today   = COALESCE(assigned_today,0) + 1,
               last_assigned_at = now()
         WHERE admin_user_id = _agent;

        BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
          VALUES (_lead.id, _agent, NULL, 'morning_drain_rr', 'Morning queue drain -> round-robin');
        EXCEPTION WHEN OTHERS THEN NULL; END;

        BEGIN INSERT INTO public.lead_activities (lead_id, activity_type, description)
          VALUES (_lead.id, 'system', 'Morning queue drained to round-robin agent');
        EXCEPTION WHEN OTHERS THEN NULL; END;

        _rr_count := _rr_count + 1;
        _next_slot := 'pool';
        CONTINUE;
      END IF;
    END IF;

    UPDATE public.sales_leads
       SET queue          = 'live_open_pool',
           pool_status    = 'new',
           last_action_at = now(),
           updated_at     = now()
     WHERE id = _lead.id;

    BEGIN INSERT INTO public.shark_tank_pool(lead_id, team_id, status)
      VALUES (_lead.id, NULL, 'queued') ON CONFLICT (lead_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.shark_tank_audit(lead_id, action, payload)
      VALUES (_lead.id, 'queued', jsonb_build_object('via','morning_drain'));
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES (_lead.id, NULL, NULL, 'morning_drain_pool', 'Morning queue drain -> Open Pool');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    BEGIN INSERT INTO public.lead_activities (lead_id, activity_type, description)
      VALUES (_lead.id, 'system', 'Morning queue drained to Open Pool (self-serve)');
    EXCEPTION WHEN OTHERS THEN NULL; END;

    _pool_count := _pool_count + 1;
    _next_slot := 'rr';
  END LOOP;

  assigned_rr := _rr_count;
  assigned_pool := _pool_count;
  skipped := _skipped;
  RETURN NEXT;
END;
$function$;