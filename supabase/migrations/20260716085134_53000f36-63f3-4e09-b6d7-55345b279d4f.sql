
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS claim_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sales_leads_claim_count ON public.sales_leads(claim_count) WHERE claim_count > 0;

UPDATE public.sales_leads sl
SET claim_count = sub.cnt,
    last_claimed_at = sub.last_at
FROM (
  SELECT lead_id, COUNT(*)::int AS cnt, MAX(created_at) AS last_at
  FROM public.lead_assignment_audit
  WHERE assignment_type IN ('recontact_bulk_claim','recontact_bulk_assign')
  GROUP BY lead_id
) sub
WHERE sl.id = sub.lead_id;

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
  _pending int;
  _claimed int := 0;
  _remaining int := 0;
  _oldest_days int := 0;
  _min_age interval := interval '30 days';
BEGIN
  SELECT id INTO _admin_id
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0, 0, 0;
    RETURN;
  END IF;

  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 200; END IF;
  IF _batch_size > 200 THEN _batch_size := 200; END IF;

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
      WHERE lcl.lead_id = sl.id
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
