
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
  -- One active lock per agent
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
     SET pool_status    = 'calling_locked',
         locked_by      = _agent,
         locked_at      = now(),
         last_action_at = now()
   WHERE id = (
     SELECT id
       FROM sales_leads
      WHERE queue IN (
              'live_open_pool','morning_call_queue','retry_queue',
              'callback_queue','nurture_queue'
            )
        AND (pool_status IS NULL
             OR pool_status IN ('new','callback_booked','contacted'))
        AND (owner_agent IS NULL OR owner_agent = _agent)
        AND (locked_by IS NULL OR locked_at < now() - interval '7 minutes')
        AND (next_action_at IS NULL OR next_action_at <= now())
      ORDER BY
        -- Priority tier (lower = served first)
        CASE
          WHEN 'paid_google'   = ANY(auto_tags) THEN 1
          WHEN 'paid_facebook' = ANY(auto_tags) THEN 2
          WHEN 'website_quote' = ANY(auto_tags)
               AND 'high_priority' = ANY(auto_tags)              THEN 3
          WHEN queue = 'callback_queue'
               AND next_action_at IS NOT NULL
               AND next_action_at <= now()                        THEN 4
          WHEN 'warranty_expiring' = ANY(auto_tags)               THEN 5
          WHEN 'premium_vehicle'   = ANY(auto_tags)               THEN 6
          WHEN 'website_quote'     = ANY(auto_tags)               THEN 7
          WHEN COALESCE(call_count,0) = 0                          THEN 8
          WHEN queue = 'nurture_queue'                             THEN 9
          ELSE 10
        END,
        -- Within a band: due callbacks first, then oldest lead
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
