CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size integer DEFAULT 200, _force boolean DEFAULT false)
 RETURNS TABLE(claimed_count integer, blocked_reason text, pending_count integer)
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
  _min_age interval := interval '30 days';
BEGIN
  SELECT id INTO _admin_id
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0;
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
    RETURN QUERY SELECT 0, 'pending_batch'::text, _pending;
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
      updated_at = now()
  FROM picked p
  WHERE sl.id = p.id;

  GET DIAGNOSTICS _claimed = ROW_COUNT;

  RETURN QUERY SELECT _claimed, NULL::text, 0;
END;
$function$;