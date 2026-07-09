
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size int DEFAULT 100)
RETURNS TABLE(claimed_count int, blocked_reason text, pending_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
  _pending int;
  _claimed int := 0;
BEGIN
  -- Identify the calling agent
  SELECT id INTO _admin_id
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0;
    RETURN;
  END IF;

  -- Cap batch size
  IF _batch_size IS NULL OR _batch_size < 1 THEN _batch_size := 100; END IF;
  IF _batch_size > 100 THEN _batch_size := 100; END IF;

  -- Count agent's still-unworked leads from previous claim
  -- "Unworked" = assigned to me AND still in 'new' status (no status change since claim)
  SELECT COUNT(*) INTO _pending
  FROM public.sales_leads
  WHERE assigned_to = _admin_id
    AND status = 'new';

  IF _pending > 0 THEN
    RETURN QUERY SELECT 0, 'pending_batch'::text, _pending;
    RETURN;
  END IF;

  -- Atomically pick oldest unassigned leads, skipping any locked by concurrent claims,
  -- so two agents can't grab the same lead.
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
$$;

GRANT EXECUTE ON FUNCTION public.claim_recontact_leads_batch(int) TO authenticated;
