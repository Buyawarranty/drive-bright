CREATE OR REPLACE FUNCTION public.deactivated_agent_leaves_distribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_active = false AND COALESCE(OLD.is_active, true) = true)
     OR (NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL) THEN
    UPDATE public.agent_distribution_caps
      SET paused = true, updated_at = now()
      WHERE admin_user_id = NEW.id;

    UPDATE public.lead_team_members
      SET workstream_new_leads = false,
          workstream_recontact = false,
          workstream_renewals = false
      WHERE admin_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivated_agent_leaves_distribution ON public.admin_users;
CREATE TRIGGER trg_deactivated_agent_leaves_distribution
AFTER UPDATE OF is_active, archived_at ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.deactivated_agent_leaves_distribution();

-- Back-fill: any already switched-off staff still enabled for distribution
UPDATE public.agent_distribution_caps c
SET paused = true, updated_at = now()
FROM public.admin_users u
WHERE u.id = c.admin_user_id
  AND (u.is_active = false OR u.archived_at IS NOT NULL)
  AND c.paused IS DISTINCT FROM true;

UPDATE public.lead_team_members m
SET workstream_new_leads = false,
    workstream_recontact = false,
    workstream_renewals = false
FROM public.admin_users u
WHERE u.id = m.admin_user_id
  AND (u.is_active = false OR u.archived_at IS NOT NULL)
  AND (m.workstream_new_leads OR m.workstream_recontact OR m.workstream_renewals);