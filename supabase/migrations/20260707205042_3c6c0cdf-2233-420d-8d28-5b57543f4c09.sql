
-- 1) Extend the auto-tag INSERT trigger with queue + status routing
CREATE OR REPLACE FUNCTION public.open_pool_auto_tag_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tags text[] := ARRAY[]::text[];
  _hour_uk integer;
  _min_uk  integer;
  _in_hours boolean;
BEGIN
  -- Source tags
  IF NEW.lead_source::text = 'google_ad' THEN
    _tags := _tags || ARRAY['paid_google', 'high_priority'];
  ELSIF NEW.lead_source::text = 'social_ad' THEN
    _tags := _tags || ARRAY['paid_facebook', 'high_priority'];
  ELSIF NEW.lead_source::text = 'website' THEN
    _tags := _tags || ARRAY['website_quote'];
  END IF;

  _hour_uk := EXTRACT(HOUR   FROM (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/London'));
  _min_uk  := EXTRACT(MINUTE FROM (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Europe/London'));

  -- Business hours: 09:00–18:00 UK
  _in_hours := (_hour_uk >= 9 AND _hour_uk < 18);

  -- Default Open Pool routing (do not clobber if caller already set)
  IF NEW.pool_status IS NULL THEN
    NEW.pool_status := 'new';
  END IF;
  IF NEW.queue IS NULL THEN
    IF _in_hours THEN
      NEW.queue := 'live_open_pool';
    ELSE
      NEW.queue := 'overnight_queue';
      _tags := _tags || ARRAY['overnight_lead'];
    END IF;
  ELSIF NOT _in_hours THEN
    -- Still tag as overnight even if queue was pre-set
    _tags := _tags || ARRAY['overnight_lead'];
  END IF;

  IF array_length(_tags, 1) IS NOT NULL THEN
    NEW.auto_tags := (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(NEW.auto_tags, ARRAY[]::text[]) || _tags))
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Promote overnight queue → morning call queue once we're past 09:00 UK
CREATE OR REPLACE FUNCTION public.open_pool_promote_overnight()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hour_uk integer;
  _moved integer := 0;
BEGIN
  _hour_uk := EXTRACT(HOUR FROM (now() AT TIME ZONE 'Europe/London'));
  IF _hour_uk < 9 OR _hour_uk >= 18 THEN
    RETURN 0;
  END IF;

  WITH moved AS (
    UPDATE public.sales_leads
       SET queue = 'morning_call_queue',
           auto_tags = (
             SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['morning_queue']))
           ),
           last_action_at = now()
     WHERE queue = 'overnight_queue'
       AND COALESCE(pool_status,'new') NOT IN ('converted','lost','invalid')
    RETURNING id
  )
  SELECT count(*) INTO _moved FROM moved;

  RETURN _moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_promote_overnight() TO authenticated, service_role;

-- 3) Restrict Get Next Lead to visible working queues
CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
RETURNS TABLE(lead_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _picked uuid;
BEGIN
  SELECT id INTO _existing
    FROM sales_leads
   WHERE locked_by = _agent
     AND pool_status = 'calling_locked'
   ORDER BY locked_at DESC
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT _existing;
    RETURN;
  END IF;

  UPDATE sales_leads
     SET pool_status = 'calling_locked',
         locked_by = _agent,
         locked_at = now(),
         last_action_at = now()
   WHERE id = (
     SELECT id
       FROM sales_leads
      WHERE queue IN ('live_open_pool','morning_call_queue','retry_queue','callback_queue')
        AND (pool_status IS NULL
             OR pool_status IN ('new','callback_booked','contacted'))
        AND (owner_agent IS NULL OR owner_agent = _agent)
        AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
        AND (next_action_at IS NULL OR next_action_at <= now())
      ORDER BY
        CASE queue
          WHEN 'callback_queue'     THEN 0
          WHEN 'morning_call_queue' THEN 1
          WHEN 'live_open_pool'     THEN 2
          WHEN 'retry_queue'        THEN 3
          ELSE 9
        END,
        next_action_at NULLS LAST,
        created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id INTO _picked;

  RETURN QUERY SELECT _picked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_pool_get_next(uuid) TO authenticated;

-- 4) Cron: every minute check whether it's time to promote overnight leads
DO $$
DECLARE _jid bigint;
BEGIN
  FOR _jid IN SELECT jobid FROM cron.job WHERE jobname = 'open-pool-promote-overnight'
  LOOP PERFORM cron.unschedule(_jid); END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'open-pool-promote-overnight',
  '* * * * *',
  $$SELECT public.open_pool_promote_overnight();$$
);
