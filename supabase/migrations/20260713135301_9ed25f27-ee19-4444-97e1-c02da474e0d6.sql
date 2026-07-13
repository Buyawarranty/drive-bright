
CREATE OR REPLACE FUNCTION public.guard_assignee_must_be_sales()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role text;
  v_email text;
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
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_assignee_must_be_sales ON public.sales_leads;
CREATE TRIGGER trg_guard_assignee_must_be_sales
BEFORE INSERT OR UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.guard_assignee_must_be_sales();
