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
  IF v_caller IS NOT NULL THEN
    v_is_manager := public.can_manage_lead_routing(v_caller);
  END IF;
  v_worked := COALESCE(public.lead_has_human_activity(OLD.id), false);

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

  IF v_caller IS NOT NULL THEN
    SELECT COALESCE(
             NULLIF(btrim(concat_ws(' ', au.first_name, au.last_name)), ''),
             au.email,
             v_caller::text
           )
      INTO v_actor
    FROM public.admin_users au
    WHERE au.user_id = v_caller
    LIMIT 1;
  END IF;

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