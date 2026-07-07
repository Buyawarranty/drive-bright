
CREATE OR REPLACE FUNCTION public.open_pool_flag_missed_callbacks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rec record;
  _count integer := 0;
BEGIN
  FOR _rec IN
    SELECT id, owner_agent, next_action_at, first_name, last_name, phone
      FROM sales_leads
     WHERE queue = 'callback_queue'
       AND pool_status = 'callback_booked'
       AND next_action_at IS NOT NULL
       AND next_action_at < now() - interval '15 minutes'
       AND NOT ('callback_missed' = ANY(COALESCE(auto_tags, ARRAY[]::text[])))
       -- No newer call activity since the callback time
       AND (last_action_at IS NULL OR last_action_at <= next_action_at)
  LOOP
    UPDATE sales_leads
       SET auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(
               COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['callback_missed']
             ))
           ),
           last_action_at = COALESCE(last_action_at, now())
     WHERE id = _rec.id;

    INSERT INTO public.system_event_logs (event_type, event_source, event_data)
    VALUES (
      'open_pool_callback_missed',
      'open_pool',
      jsonb_build_object(
        'lead_id', _rec.id,
        'owner_agent', _rec.owner_agent,
        'callback_time', _rec.next_action_at,
        'name', trim(coalesce(_rec.first_name,'') || ' ' || coalesce(_rec.last_name,'')),
        'phone', _rec.phone,
        'overdue_by_minutes', EXTRACT(EPOCH FROM (now() - _rec.next_action_at))/60
      )
    );
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_flag_missed_callbacks() TO authenticated, service_role;

DO $$
DECLARE _jid bigint;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'open-pool-flag-missed-callbacks'
  LOOP PERFORM cron.unschedule(_jid); END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'open-pool-flag-missed-callbacks',
  '* * * * *',
  $$SELECT public.open_pool_flag_missed_callbacks();$$
);
