-- 1. Widen the definition of a worked lead: notes, call logs, Zoiper/Dial 9
--    phone events, or an agent-driven status change all count.
CREATE OR REPLACE FUNCTION public.lead_has_human_activity(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    EXISTS (SELECT 1 FROM public.lead_quick_notes lqn WHERE lqn.lead_id = p_lead_id)
    OR EXISTS (SELECT 1 FROM public.lead_call_logs lcl WHERE lcl.lead_id = p_lead_id::text)
    OR EXISTS (
      SELECT 1 FROM public.phone_events pe
      WHERE pe.lead_id = p_lead_id::text
        AND pe.agent_id IS NOT NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.sales_leads sl
      WHERE sl.id = p_lead_id
        AND (
          COALESCE(sl.call_count, 0) > 0
          OR COALESCE(sl.manual_call_adjustment, 0) > 0
          OR sl.last_contacted_at IS NOT NULL
          OR COALESCE(btrim(sl.notes), '') <> ''
          OR sl.status IS DISTINCT FROM 'new'::lead_status
        )
    );
$function$;

-- 2. Audit trail columns
ALTER TABLE public.lead_assignment_audit
  ADD COLUMN IF NOT EXISTS previous_assigned_to_id uuid,
  ADD COLUMN IF NOT EXISTS changed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS was_worked boolean;

-- 3. Log EVERY owner change (manual or automatic) plus blocked attempts.
CREATE OR REPLACE FUNCTION public.audit_lead_assignment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_is_manager boolean := false;
  v_worked boolean := false;
  v_type text;
  v_actor text;
  v_blocked boolean := false;
BEGIN
  -- Nothing to record when the owner did not move.
  IF NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to
     AND NEW.assigned_to IS NOT DISTINCT FROM TG_ARGV[0]::uuid THEN
    NULL;
  END IF;

  IF v_caller IS NOT NULL THEN
    v_is_manager := public.can_manage_lead_routing(v_caller);
  END IF;
  v_worked := COALESCE(public.lead_has_human_activity(OLD.id), false);

  -- The protection trigger runs first; if it reverted the change, NEW matches OLD.
  v_blocked := (NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to);

  IF v_blocked THEN
    v_type := 'blocked_worked_lead';
  ELSIF v_is_manager THEN
    v_type := 'manager_reassign';
  ELSIF v_caller IS NOT NULL THEN
    v_type := 'manual_reassign';
  ELSE
    v_type := 'automatic';
  END IF;

  SELECT COALESCE(au.name, au.email, v_caller::text)
    INTO v_actor
  FROM public.admin_users au
  WHERE au.user_id = v_caller
  LIMIT 1;

  BEGIN
    INSERT INTO public.lead_assignment_audit (
      lead_id, assigned_to_id, previous_assigned_to_id, changed_by_user_id,
      assigned_by, assignment_type, reason, was_worked
    ) VALUES (
      OLD.id,
      NEW.assigned_to,
      OLD.assigned_to,
      v_caller,
      COALESCE(v_actor, CASE WHEN v_caller IS NULL THEN 'system' ELSE v_caller::text END),
      v_type,
      CASE
        WHEN v_blocked THEN 'Automatic reassignment blocked — lead already worked or owned; kept with existing agent'
        WHEN v_type = 'manager_reassign' THEN 'Manager reassignment'
        WHEN v_type = 'manual_reassign' THEN 'Reassigned by signed-in user'
        ELSE 'Automatic distribution'
      END,
      v_worked
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_zz_audit_lead_assignment ON public.sales_leads;
CREATE TRIGGER trg_zz_audit_lead_assignment
AFTER UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW
WHEN (NEW.assigned_to IS DISTINCT FROM OLD.assigned_to OR OLD.assigned_to IS NOT NULL)
EXECUTE FUNCTION public.audit_lead_assignment_change();