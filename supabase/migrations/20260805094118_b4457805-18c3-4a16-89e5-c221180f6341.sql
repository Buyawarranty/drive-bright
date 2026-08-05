-- 1. Per-agent recontact permissions, manager controlled
ALTER TABLE public.recontact_agent_caps
  ADD COLUMN IF NOT EXISTS can_self_assign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_reassign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_batch_check boolean NOT NULL DEFAULT false;

-- 2. Self-claim batch: permission comes from the caps row, not hard-coded emails
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_batch(_batch_size integer DEFAULT 200, _force boolean DEFAULT false)
 RETURNS TABLE(claimed_count integer, blocked_reason text, pending_count integer, pool_remaining integer, oldest_age_days integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '120s'
 SET lock_timeout TO '10s'
AS $function$
DECLARE
  _admin_id uuid;
  _admin_role text;
  _pending int;
  _claimed int := 0;
  _remaining int := 0;
  _oldest_days int := 0;
  _min_age interval := interval '30 days';
  _exempt boolean := false;
  _can_self boolean := false;
  _blocked boolean := false;
  _is_mgmt boolean := false;
BEGIN
  SELECT id, role INTO _admin_id, _admin_role
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RETURN QUERY SELECT 0, 'not_admin'::text, 0, 0, 0;
    RETURN;
  END IF;

  _is_mgmt := _admin_role IN ('admin','super_admin','sales_manager');

  SELECT COALESCE(can_self_assign, false), COALESCE(skip_batch_check, false), COALESCE(blocked, false)
    INTO _can_self, _exempt, _blocked
  FROM public.recontact_agent_caps
  WHERE admin_user_id = _admin_id;

  IF NOT _is_mgmt THEN
    IF _blocked THEN
      RETURN QUERY SELECT 0, 'recontact_off'::text, 0, 0, 0;
      RETURN;
    END IF;
    IF NOT COALESCE(_can_self, false) THEN
      RETURN QUERY SELECT 0, 'self_assign_not_allowed'::text, 0, 0, 0;
      RETURN;
    END IF;
  ELSE
    _exempt := true;
  END IF;

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

-- 3. Individual self-claim from the pool honours the same permission
CREATE OR REPLACE FUNCTION public.claim_recontact_leads_self(_lead_ids uuid[])
 RETURNS TABLE(claimed_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _admin_id uuid;
  _admin_role text;
  _allowed boolean := false;
BEGIN
  IF _lead_ids IS NULL OR array_length(_lead_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT id, role INTO _admin_id, _admin_role
  FROM public.admin_users
  WHERE user_id = auth.uid() AND is_active = true
  LIMIT 1;

  IF _admin_id IS NULL THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  IF _admin_role IN ('admin','super_admin','sales_manager') THEN
    _allowed := true;
  ELSE
    SELECT COALESCE(can_self_assign, false) AND NOT COALESCE(blocked, false)
      INTO _allowed
    FROM public.recontact_agent_caps
    WHERE admin_user_id = _admin_id;
  END IF;

  IF NOT COALESCE(_allowed, false) THEN
    RAISE EXCEPTION 'self_assign_not_allowed';
  END IF;

  RETURN QUERY
  WITH updated AS (
    UPDATE public.sales_leads sl
    SET assigned_to = _admin_id,
        assigned_at = now(),
        status = 'new'::lead_status,
        last_claimed_at = now(),
        claim_count = COALESCE(sl.claim_count, 0) + 1,
        hidden_from_agent_ids = CASE
          WHEN sl.assigned_to IS NOT NULL
               AND sl.assigned_to <> _admin_id
               AND NOT (sl.assigned_to = ANY(COALESCE(sl.hidden_from_agent_ids, '{}'::uuid[])))
          THEN array_append(COALESCE(sl.hidden_from_agent_ids, '{}'::uuid[]), sl.assigned_to)
          ELSE COALESCE(sl.hidden_from_agent_ids, '{}'::uuid[])
        END
    WHERE sl.id = ANY(_lead_ids)
      AND (sl.assigned_to IS DISTINCT FROM _admin_id)
    RETURNING sl.id
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
$function$;

-- 4. Turn the permissions on for the agents working this pool
INSERT INTO public.recontact_agent_caps (admin_user_id, can_self_assign, can_reassign, skip_batch_check, blocked)
SELECT a.id, true, true, true, false
FROM public.admin_users a
WHERE lower(a.email) IN ('greg.phillips@buyawarranty.co.uk','freddie.howard@buyawarranty.co.uk')
ON CONFLICT (admin_user_id) DO UPDATE
SET can_self_assign = true,
    can_reassign = true,
    skip_batch_check = true,
    blocked = false,
    updated_at = now();

-- Greg also needs the general lead-reassign right for recontact rows
UPDATE public.agent_distribution_caps d
SET can_reassign_leads = true,
    reassign_scope = COALESCE(d.reassign_scope, 'own_team'),
    updated_at = now()
WHERE d.admin_user_id IN (
  SELECT a.id FROM public.admin_users a
  WHERE lower(a.email) IN ('greg.phillips@buyawarranty.co.uk','freddie.howard@buyawarranty.co.uk')
);