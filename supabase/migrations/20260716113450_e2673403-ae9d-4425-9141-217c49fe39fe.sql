
-- 1) Patch open_pool_get_next: for live_open_pool candidates, require call_count = 0 AND status = 'new'.
--    Other queues (retry, callback, nurture) continue to allow previously-called leads — that's their purpose.
CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
 RETURNS TABLE(lead_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing uuid;
  _due_retry uuid;
  _picked uuid;
BEGIN
  SELECT id INTO _existing
    FROM public.sales_leads
   WHERE locked_by = _agent
     AND pool_status = 'calling_locked'
   ORDER BY locked_at DESC
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN QUERY SELECT _existing;
    RETURN;
  END IF;

  SELECT id INTO _due_retry
    FROM public.sales_leads
   WHERE owner_agent = _agent
     AND queue = 'retry_queue'
     AND (next_action_at IS NULL OR next_action_at <= now())
     AND COALESCE(is_paid, false) = false
     AND status NOT IN (
           'converted'::lead_status,
           'fake_lead'::lead_status,
           'lost'::lead_status
         )
   ORDER BY next_action_at NULLS FIRST, last_action_at DESC NULLS LAST
   LIMIT 1;

  IF _due_retry IS NOT NULL THEN
    UPDATE public.sales_leads
       SET pool_status    = 'calling_locked',
           locked_by      = _agent,
           locked_at      = now(),
           last_action_at = now()
     WHERE id = _due_retry;
    RETURN QUERY SELECT _due_retry;
    RETURN;
  END IF;

  WITH ranked_candidates AS MATERIALIZED (
    SELECT
      sl.id,
      sl.email,
      sl.vehicle_reg,
      CASE
        WHEN 'paid_google'   = ANY(sl.auto_tags) THEN 1
        WHEN 'paid_facebook' = ANY(sl.auto_tags) THEN 2
        WHEN 'website_quote' = ANY(sl.auto_tags)
             AND 'high_priority' = ANY(sl.auto_tags)             THEN 3
        WHEN sl.queue = 'callback_queue'
             AND sl.next_action_at IS NOT NULL
             AND sl.next_action_at <= now()                       THEN 4
        WHEN 'warranty_expiring' = ANY(sl.auto_tags)              THEN 5
        WHEN 'premium_vehicle'   = ANY(sl.auto_tags)              THEN 6
        WHEN 'website_quote'     = ANY(sl.auto_tags)              THEN 7
        WHEN COALESCE(sl.call_count,0) = 0                        THEN 8
        WHEN sl.queue = 'nurture_queue'                           THEN 9
        ELSE 10
      END AS priority_band,
      sl.next_action_at,
      sl.created_at
    FROM public.sales_leads sl
    WHERE sl.queue IN (
            'live_open_pool','morning_call_queue','retry_queue',
            'callback_queue','nurture_queue'
          )
      AND (sl.pool_status IS NULL
           OR sl.pool_status IN ('new','callback_booked','contacted'))
      AND COALESCE(sl.is_paid, false) = false
      AND sl.status NOT IN (
            'converted'::lead_status,
            'fake_lead'::lead_status,
            'lost'::lead_status
          )
      AND (sl.owner_agent IS NULL OR sl.owner_agent = _agent)
      AND (sl.assigned_to IS NULL OR sl.assigned_to = _agent)
      AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
      AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
      -- CRITICAL: live_open_pool is for genuinely never-contacted, status='new' leads only.
      -- If a lead is already in the pool but has been called, or has moved past 'new',
      -- it must not resurface here. Other queues (retry/callback/nurture) are exempt —
      -- those are the correct homes for previously-worked leads.
      AND (
        sl.queue <> 'live_open_pool'
        OR (
          COALESCE(sl.call_count, 0) = 0
          AND sl.status = 'new'::lead_status
        )
      )
    ORDER BY priority_band, sl.next_action_at NULLS LAST, sl.created_at DESC
    LIMIT 500
  ), eligible AS MATERIALIZED (
    SELECT rc.id, rc.priority_band, rc.next_action_at, rc.created_at
    FROM ranked_candidates rc
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE COALESCE(c.is_deleted, false) = false
        AND lower(COALESCE(c.status, '')) NOT IN ('cancelled','refunded')
        AND (
          (
            COALESCE(rc.email,'') <> ''
            AND lower(c.email) = lower(rc.email)
          )
          OR (
            COALESCE(rc.vehicle_reg,'') <> ''
            AND upper(regexp_replace(c.registration_plate, '\s+', '', 'g'))
              = upper(regexp_replace(rc.vehicle_reg, '\s+', '', 'g'))
          )
        )
    )
  )
  SELECT id INTO _picked
    FROM eligible
   ORDER BY priority_band, next_action_at NULLS LAST, created_at DESC
   LIMIT 1
   FOR UPDATE SKIP LOCKED;

  IF _picked IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.sales_leads
     SET pool_status    = 'calling_locked',
         locked_by      = _agent,
         locked_at      = now(),
         last_action_at = now()
   WHERE id = _picked;

  RETURN QUERY SELECT _picked;
END;
$function$;

-- 2) Backfill: any lead currently in live_open_pool that has been contacted
--    (call_count > 0) or whose status is past 'new' gets moved out of the pool.
--    Route to retry_queue when the agent already owns it, else nurture_queue.
UPDATE public.sales_leads
   SET queue = CASE
                 WHEN assigned_to IS NOT NULL THEN 'retry_queue'
                 ELSE 'nurture_queue'
               END,
       owner_agent = COALESCE(owner_agent, assigned_to),
       updated_at  = now()
 WHERE queue = 'live_open_pool'
   AND (
     COALESCE(call_count, 0) > 0
     OR status <> 'new'::lead_status
   );
