-- 1. Patch open_pool_get_next to exclude paid / terminal-status leads and
--    leads whose email/reg already matches an active customer record.
CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
 RETURNS TABLE(lead_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     SELECT sl.id
       FROM sales_leads sl
      WHERE sl.queue IN (
              'live_open_pool','morning_call_queue','retry_queue',
              'callback_queue','nurture_queue'
            )
        AND (sl.pool_status IS NULL
             OR sl.pool_status IN ('new','callback_booked','contacted'))
        -- NEW: never surface a paid / converted / terminal lead
        AND COALESCE(sl.is_paid, false) = false
        AND sl.status NOT IN (
              'converted'::lead_status,
              'fake_lead'::lead_status,
              'lost'::lead_status
            )
        -- NEW: never surface a lead whose customer already exists & is active
        AND NOT EXISTS (
          SELECT 1
            FROM customers c
           WHERE COALESCE(c.is_deleted, false) = false
             AND lower(COALESCE(c.status, '')) NOT IN ('cancelled','refunded')
             AND (
               (COALESCE(sl.email,'') <> ''
                 AND lower(trim(sl.email)) = lower(trim(COALESCE(c.email,''))))
               OR
               (COALESCE(sl.vehicle_reg,'') <> ''
                 AND upper(regexp_replace(sl.vehicle_reg,'\s+','','g'))
                   = upper(regexp_replace(COALESCE(c.registration_plate,''),'\s+','','g')))
             )
        )
        AND (sl.owner_agent IS NULL OR sl.owner_agent = _agent)
        AND (sl.locked_by IS NULL OR sl.locked_at < now() - interval '7 minutes')
        AND (sl.next_action_at IS NULL OR sl.next_action_at <= now())
      ORDER BY
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
        END,
        sl.next_action_at NULLS LAST,
        sl.created_at DESC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
   RETURNING id INTO _picked;

  RETURN QUERY SELECT _picked;
END;
$function$;

-- 2. Backfill: re-apply the trigger logic against every lead whose email or
--    reg matches an active customer. Only touch leads that are demonstrably
--    stale (not yet converted / fake_lead), never resurrect terminal states.
WITH matched AS (
  SELECT DISTINCT sl.id
    FROM sales_leads sl
    JOIN customers c
      ON (
           (COALESCE(sl.email,'') <> ''
             AND lower(trim(sl.email)) = lower(trim(COALESCE(c.email,''))))
           OR
           (COALESCE(sl.vehicle_reg,'') <> ''
             AND upper(regexp_replace(sl.vehicle_reg,'\s+','','g'))
               = upper(regexp_replace(COALESCE(c.registration_plate,''),'\s+','','g')))
         )
   WHERE COALESCE(c.is_deleted, false) = false
     AND lower(COALESCE(c.status,'')) NOT IN ('cancelled','refunded')
     AND sl.status NOT IN ('converted'::lead_status, 'fake_lead'::lead_status)
)
UPDATE sales_leads sl
   SET status       = 'converted'::lead_status,
       is_paid      = true,
       converted_at = COALESCE(sl.converted_at, now()),
       pool_status  = NULL,
       queue        = NULL,
       locked_by    = NULL,
       locked_at    = NULL,
       updated_at   = now()
  FROM matched m
 WHERE sl.id = m.id;
