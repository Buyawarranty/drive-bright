
-- Auto-unassign leads when an admin user is deactivated or deleted
-- Preserves original_assigned_to so managers can see the former owner in the Unassigned pool

CREATE OR REPLACE FUNCTION public.unassign_leads_on_agent_offboard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_former_id uuid;
  v_affected int;
BEGIN
  -- Determine which agent is being offboarded
  IF TG_OP = 'DELETE' THEN
    v_former_id := OLD.id;
  ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.is_active, true) = true AND COALESCE(NEW.is_active, true) = false THEN
    v_former_id := NEW.id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Move all their active leads to the Unassigned pool
  -- Preserve original_assigned_to (backfill it if empty) so the former owner still shows on the lead
  WITH updated AS (
    UPDATE public.sales_leads
       SET original_assigned_to = COALESCE(original_assigned_to, v_former_id),
           assigned_to = NULL,
           assigned_at = NULL,
           updated_at = now()
     WHERE assigned_to = v_former_id
     RETURNING id
  )
  SELECT COUNT(*) INTO v_affected FROM updated;

  -- Audit each unassignment
  IF v_affected > 0 THEN
    BEGIN
      INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
      SELECT sl.id, NULL, NULL, 'agent_offboarded',
             'Auto-unassigned: agent ' || v_former_id::text || ' was ' ||
             CASE WHEN TG_OP = 'DELETE' THEN 'deleted' ELSE 'deactivated' END
      FROM public.sales_leads sl
      WHERE sl.original_assigned_to = v_former_id
        AND sl.assigned_to IS NULL
        AND sl.updated_at > now() - interval '10 seconds';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  -- Also zero out their distribution cap counters so they don't hold a slot
  BEGIN
    UPDATE public.agent_distribution_caps
       SET paused = true,
           assigned_today = 0,
           updated_at = now()
     WHERE admin_user_id = v_former_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_unassign_leads_on_agent_deactivate ON public.admin_users;
CREATE TRIGGER trg_unassign_leads_on_agent_deactivate
AFTER UPDATE OF is_active ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.unassign_leads_on_agent_offboard();

DROP TRIGGER IF EXISTS trg_unassign_leads_on_agent_delete ON public.admin_users;
CREATE TRIGGER trg_unassign_leads_on_agent_delete
BEFORE DELETE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.unassign_leads_on_agent_offboard();
