
CREATE OR REPLACE FUNCTION public.open_pool_manager_alerts_sweep()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _n integer := 0;
  _hour_uk integer;
  _agent_rec record;
BEGIN
  _hour_uk := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/London'));

  -- 1) Paid ad leads uncalled within 5 min (business hours only)
  IF _hour_uk >= 9 AND _hour_uk < 18 THEN
    FOR _rec IN
      SELECT id, first_name, last_name, phone, lead_source, created_at, owner_agent
        FROM sales_leads
       WHERE queue IN ('live_open_pool','morning_call_queue','retry_queue','callback_queue')
         AND COALESCE(call_count, 0) = 0
         AND ('paid_google' = ANY(COALESCE(auto_tags, ARRAY[]::text[]))
              OR 'paid_facebook' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
         AND created_at < now() - interval '5 minutes'
         AND NOT ('mgr_alert_paid_lead_uncalled' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
    LOOP
      UPDATE sales_leads
         SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(
               COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['mgr_alert_paid_lead_uncalled'])))
       WHERE id = _rec.id;
      INSERT INTO public.system_event_logs (event_type, event_source, event_data)
      VALUES ('open_pool_paid_lead_uncalled', 'open_pool',
        jsonb_build_object(
          'lead_id', _rec.id, 'owner_agent', _rec.owner_agent,
          'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
          'phone', _rec.phone, 'lead_source', _rec.lead_source,
          'created_at', _rec.created_at,
          'overdue_by_minutes', EXTRACT(EPOCH FROM (now() - _rec.created_at))/60
        ));
      _n := _n + 1;
    END LOOP;
  END IF;

  -- 2) High-priority lead still open after 24h
  FOR _rec IN
    SELECT id, first_name, last_name, phone, lead_source, created_at, owner_agent
      FROM sales_leads
     WHERE 'high_priority' = ANY(COALESCE(auto_tags, ARRAY[]::text[]))
       AND COALESCE(pool_status,'new') NOT IN ('converted','lost','invalid')
       AND created_at < now() - interval '24 hours'
       AND NOT ('mgr_alert_high_priority_stale' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
  LOOP
    UPDATE sales_leads
       SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(
             COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['mgr_alert_high_priority_stale'])))
     WHERE id = _rec.id;
    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES ('open_pool_high_priority_stale', 'open_pool',
      jsonb_build_object(
        'lead_id', _rec.id, 'owner_agent', _rec.owner_agent,
        'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
        'phone', _rec.phone, 'lead_source', _rec.lead_source,
        'created_at', _rec.created_at,
        'overdue_by_hours', EXTRACT(EPOCH FROM (now() - _rec.created_at))/3600
      ));
    _n := _n + 1;
  END LOOP;

  -- 3) Overnight queue not cleared: still in morning_call_queue after 11:00 UK
  IF _hour_uk >= 11 AND _hour_uk < 18 THEN
    FOR _rec IN
      SELECT id, first_name, last_name, phone, lead_source, created_at, owner_agent
        FROM sales_leads
       WHERE queue = 'morning_call_queue'
         AND COALESCE(call_count, 0) = 0
         AND NOT ('mgr_alert_morning_queue_stale' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
    LOOP
      UPDATE sales_leads
         SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(
               COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['mgr_alert_morning_queue_stale'])))
       WHERE id = _rec.id;
      INSERT INTO public.system_event_logs (event_type, event_source, event_data)
      VALUES ('open_pool_morning_queue_stale', 'open_pool',
        jsonb_build_object(
          'lead_id', _rec.id, 'owner_agent', _rec.owner_agent,
          'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
          'phone', _rec.phone, 'lead_source', _rec.lead_source,
          'created_at', _rec.created_at
        ));
      _n := _n + 1;
    END LOOP;
  END IF;

  -- 4) No-answer lead exceeded retry limit
  FOR _rec IN
    SELECT id, first_name, last_name, phone, lead_source, created_at, owner_agent, call_count
      FROM sales_leads
     WHERE 'lost_could_not_contact' = ANY(COALESCE(auto_tags, ARRAY[]::text[]))
       AND NOT ('mgr_alert_no_answer_exhausted' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
  LOOP
    UPDATE sales_leads
       SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(
             COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['mgr_alert_no_answer_exhausted'])))
     WHERE id = _rec.id;
    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES ('open_pool_no_answer_exhausted', 'open_pool',
      jsonb_build_object(
        'lead_id', _rec.id, 'owner_agent', _rec.owner_agent,
        'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
        'phone', _rec.phone, 'lead_source', _rec.lead_source,
        'call_count', _rec.call_count
      ));
    _n := _n + 1;
  END LOOP;

  -- 5) Agents marking too many Lost / Not Interested in rolling 24h (>8)
  FOR _agent_rec IN
    SELECT owner_agent, count(*) AS n
      FROM sales_leads
     WHERE last_action_at > now() - interval '24 hours'
       AND call_outcome = 'not_interested'
       AND owner_agent IS NOT NULL
     GROUP BY owner_agent
    HAVING count(*) > 8
       AND NOT EXISTS (
         SELECT 1 FROM system_event_logs
          WHERE event_type = 'open_pool_agent_too_many_lost'
            AND event_source = 'open_pool'
            AND created_at > now() - interval '24 hours'
            AND (event_data->>'agent_id')::uuid = sales_leads.owner_agent
       )
  LOOP
    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES ('open_pool_agent_too_many_lost', 'open_pool',
      jsonb_build_object(
        'agent_id', _agent_rec.owner_agent,
        'lost_count_24h', _agent_rec.n
      ));
    _n := _n + 1;
  END LOOP;

  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_manager_alerts_sweep() TO authenticated, service_role;

DO $$
DECLARE _jid bigint;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'open-pool-manager-alerts-sweep'
  LOOP PERFORM cron.unschedule(_jid); END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'open-pool-manager-alerts-sweep',
  '*/5 * * * *',
  $$SELECT public.open_pool_manager_alerts_sweep();$$
);

-- Also emit an alert whenever the 7-min lock reaper releases a lead
CREATE OR REPLACE FUNCTION public.open_pool_reap_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _released integer := 0;
BEGIN
  FOR _rec IN
    SELECT id, locked_by, locked_at, first_name, last_name, phone, lead_source
      FROM sales_leads
     WHERE pool_status = 'calling_locked'
       AND locked_at IS NOT NULL
       AND locked_at < now() - interval '7 minutes'
       AND call_outcome IS NULL
       AND next_action_at IS NULL
  LOOP
    UPDATE sales_leads
       SET pool_status    = 'new',
           locked_by      = NULL,
           locked_at      = NULL,
           last_action_at = now(),
           auto_tags      = (
             SELECT ARRAY(SELECT DISTINCT unnest(
               COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['recycled_to_pool']
             ))
           )
     WHERE id = _rec.id;

    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES ('open_pool_lock_expired', 'open_pool',
      jsonb_build_object(
        'lead_id', _rec.id, 'owner_agent', _rec.locked_by,
        'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
        'phone', _rec.phone, 'lead_source', _rec.lead_source,
        'locked_at', _rec.locked_at
      ));
    _released := _released + 1;
  END LOOP;

  RETURN _released;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_reap_expired_locks() TO authenticated, service_role;
