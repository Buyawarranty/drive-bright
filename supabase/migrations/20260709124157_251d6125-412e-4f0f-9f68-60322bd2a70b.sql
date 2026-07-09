
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_self(_lead_ids uuid[])
RETURNS TABLE(claimed_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_id uuid;
BEGIN
  IF _lead_ids IS NULL OR array_length(_lead_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO _admin_id
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE public.sales_leads sl
    SET assigned_to = _admin_id,
        assigned_at = now()
    WHERE sl.id = ANY(_lead_ids)
      AND (sl.assigned_to IS DISTINCT FROM _admin_id)
    RETURNING sl.id, sl.assigned_to AS new_owner
  ),
  audited AS (
    INSERT INTO public.lead_assignment_audit
      (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
    SELECT u.id, _admin_id, _admin_id, 'recontact_bulk_claim',
           'Self-claimed from Recontact pool'
    FROM updated u
    RETURNING lead_id
  )
  SELECT id FROM updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_recontact_leads_self(uuid[]) TO authenticated;
