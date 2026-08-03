CREATE OR REPLACE FUNCTION public.guard_assignee_must_be_sales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_email text;
  v_paused boolean;
  v_mode text;
  v_works_new boolean;
  v_manual boolean := auth.uid() IS NOT NULL;
  v_replacement uuid;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only re-check when assigned_to actually changed
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  SELECT role, email
    INTO v_role, v_email
  FROM public.admin_users
  WHERE id = NEW.assigned_to
     OR user_id = NEW.assigned_to
  ORDER BY (id = NEW.assigned_to) DESC
  LIMIT 1;

  -- If the target isn't a sales worker, refuse the assignment
  IF v_role IS NULL OR v_role NOT IN ('sales','sales_lead') THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit
        (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      VALUES
        (NEW.id, NULL, NULL, 'blocked_non_sales_assignee',
         format('Blocked assignment to non-sales account (%s, role=%s). Falling back to router.',
                COALESCE(v_email,'unknown'), COALESCE(v_role,'unknown')));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    NEW.assigned_to := NULL;
    RETURN NEW;
  END IF;

  -- ── The "Agents receiving leads" switches are the source of truth ──────────
  -- Automated assignment can only land on an agent that is switched ON, is on
  -- Round Robin (not Open Round Robin) and works New Leads. Manual manager
  -- assignment (a signed-in user) is still allowed.
  IF NOT v_manual THEN
    SELECT COALESCE(adc.paused, false), COALESCE(adc.assignment_mode, 'round_robin')
      INTO v_paused, v_mode
    FROM public.agent_distribution_caps adc
    WHERE adc.admin_user_id = NEW.assigned_to;

    v_works_new := public.agent_works_new_leads(NEW.assigned_to);

    IF COALESCE(v_paused, false) OR COALESCE(v_mode, 'round_robin') = 'open_pool' OR NOT COALESCE(v_works_new, true) THEN
      -- Try to hand it to the next switched-on Round Robin agent instead.
      BEGIN
        v_replacement := public.pick_agent_for_distribution(NULL, NEW.lead_source::text);
      EXCEPTION WHEN OTHERS THEN
        v_replacement := NULL;
      END;

      BEGIN
        INSERT INTO public.lead_assignment_audit
          (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES
          (NEW.id, v_replacement, NULL, 'blocked_switched_off_assignee',
           format('Blocked automatic assignment to %s (switched off / open pool / not on New Leads)%s',
                  COALESCE(v_email,'unknown'),
                  CASE WHEN v_replacement IS NULL
                       THEN ' — no switched-on agent available, left waiting'
                       ELSE ' — re-routed to next Round Robin agent' END));
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      NEW.assigned_to := v_replacement;
      IF v_replacement IS NULL THEN
        NEW.owner_agent := NULL;
        NEW.assigned_at := NULL;
      ELSE
        NEW.assigned_at := now();
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;