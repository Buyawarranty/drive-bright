-- Exempt sales@ and Freddie from the pending-batch restriction, and add a
-- counter RPC that reports how many leads are truly recontactable (unassigned
-- + no contact in last 60 days).

DROP FUNCTION IF EXISTS public.claim_recontact_leads_batch(integer, boolean);

CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(
  _batch_size integer DEFAULT 200,
  _force boolean DEFAULT false
)
RETURNS TABLE(
  claimed_count integer,
  blocked_reason text,
  pending_count integer,
  pool_remaining integer,
  oldest_age_days integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '120s'
SET lock_timeout TO '10s'
AS $function$
DECLARE
  _admin_id uuid;
  _admin_email text;
  _pending int;
  _claimed int := 0;
  _remaining int := 0;
  _oldest_days int := 0;
  _min_age interval := interval '30 days';
  _exempt boolean := false;
BEGIN
  SELECT id, lower(email) INTO _admin_id, _admin_email
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0, 0, 0;
    RETURN;
  END IF;

  -- sales@ and Freddie are assigned to work through recontact leads and
  -- should never be blocked by the pending-batch guard.
  _exempt := _admin_email IN ('sales@buyawarranty.co.uk', 'freddie.howard@buyawarranty.co.uk');

  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 200; END IF;
  IF _batch_size > 200 THEN _batch_size := 200; END IF;

  IF NOT _exempt THEN
    SELECT COUNT(*) INTO _pending
    FROM public.sales_leads sl
    WHERE sl.assigned_to = _admin_id
      AND sl.status = 'new'
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_quick_notes lqn
        WHERE lqn.lead_id = sl.id
          AND lqn.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_call_logs lcl
        WHERE lcl.lead_id::uuid = sl.id
          AND lcl.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.lead_activities la
        WHERE la.lead_id = sl.id
          AND la.created_at >= COALESCE(sl.assigned_at, sl.created_at)
      );

    IF _pending > 0 AND NOT _force THEN
      RETURN QUERY SELECT 0, 'pending_batch'::text, _pending, 0, 0;
      RETURN;
    END IF;
  END IF;

  WITH picked AS (
    SELECT sl.id
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
      AND sl.created_at < now() - _min_age
    ORDER BY sl.created_at ASC
    LIMIT _batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.sales_leads sl
  SET assigned_to = _admin_id,
      assigned_at = now(),
      claim_count = COALESCE(sl.claim_count, 0) + 1,
      last_claimed_at = now(),
      updated_at = now()
  FROM picked p
  WHERE sl.id = p.id;

  GET DIAGNOSTICS _claimed = ROW_COUNT;

  SELECT COUNT(*)::int,
         COALESCE(EXTRACT(day FROM now() - MIN(created_at))::int, 0)
    INTO _remaining, _oldest_days
  FROM public.sales_leads
  WHERE assigned_to IS NULL
    AND status NOT IN ('lost','fake_lead','converted','archived')
    AND created_at < now() - _min_age;

  RETURN QUERY SELECT _claimed, NULL::text, 0, _remaining, _oldest_days;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_recontact_leads_batch(integer, boolean) TO authenticated;

-- Live counter of leads available to recontact: unassigned, not in a terminal
-- status, and with no call log / quick note in the last 60 days.
CREATE OR REPLACE FUNCTION public.count_recontact_leads_available()
RETURNS TABLE(available_count integer, pool_total integer, oldest_age_days integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH pool AS (
    SELECT sl.id, sl.created_at
    FROM public.sales_leads sl
    WHERE sl.assigned_to IS NULL
      AND sl.status NOT IN ('lost','fake_lead','converted','archived')
  ),
  no_contact AS (
    SELECT p.id, p.created_at
    FROM pool p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_call_logs lcl
      WHERE lcl.lead_id::uuid = p.id AND lcl.created_at > now() - interval '60 days'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lead_quick_notes lqn
      WHERE lqn.lead_id = p.id AND lqn.created_at > now() - interval '60 days'
    )
  )
  SELECT
    (SELECT COUNT(*)::int FROM no_contact),
    (SELECT COUNT(*)::int FROM pool),
    COALESCE((SELECT EXTRACT(day FROM now() - MIN(created_at))::int FROM no_contact), 0);
$$;

GRANT EXECUTE ON FUNCTION public.count_recontact_leads_available() TO authenticated;