CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size integer DEFAULT 100, _force boolean DEFAULT false)
 RETURNS TABLE(claimed_count integer, blocked_reason text, pending_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _pending int;
  _claimed int := 0;
BEGIN
  SELECT id INTO _admin_id
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0;
    RETURN;
  END IF;

  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 100; END IF;
  IF _batch_size > 100 THEN _batch_size := 100; END IF;

  SELECT COUNT(*) INTO _pending
  FROM public.sales_leads
  WHERE assigned_to = _admin_id
    AND status = 'new';

  IF _pending > 0 AND NOT _force THEN
    RETURN QUERY SELECT 0, 'pending_batch'::text, _pending;
    RETURN;
  END IF;

  WITH picked AS (
    SELECT id
    FROM public.sales_leads
    WHERE assigned_to IS NULL
      AND status NOT IN ('lost','fake_lead','converted','archived')
    ORDER BY created_at ASC
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