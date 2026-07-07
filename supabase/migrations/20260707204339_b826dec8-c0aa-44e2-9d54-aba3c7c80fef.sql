
CREATE OR REPLACE FUNCTION public.open_pool_reap_expired_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _released integer := 0;
BEGIN
  WITH released AS (
    UPDATE public.sales_leads
    SET
      pool_status    = 'new',
      locked_by      = NULL,
      locked_at      = NULL,
      last_action_at = now(),
      auto_tags      = (
        SELECT ARRAY(
          SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['recycled_to_pool'])
        )
      )
    WHERE pool_status = 'calling_locked'
      AND locked_at IS NOT NULL
      AND locked_at < now() - interval '7 minutes'
      AND call_outcome IS NULL
      AND next_action_at IS NULL
    RETURNING id
  )
  SELECT count(*) INTO _released FROM released;

  RETURN _released;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_reap_expired_locks() TO authenticated, service_role;

DO $$
DECLARE _jid bigint;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'open-pool-reap-expired-locks'
  LOOP
    PERFORM cron.unschedule(_jid);
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'open-pool-reap-expired-locks',
  '* * * * *',
  $$SELECT public.open_pool_reap_expired_locks();$$
);
