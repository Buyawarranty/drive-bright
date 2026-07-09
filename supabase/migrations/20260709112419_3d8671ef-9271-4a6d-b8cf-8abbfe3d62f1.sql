CREATE OR REPLACE FUNCTION public.log_lead_status_change_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor_admin_id uuid;
  _actor_name text;
  _note text;
BEGIN
  -- Only fire on real status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Resolve acting admin (falls back to assigned agent if no session user)
  SELECT id, COALESCE(NULLIF(full_name, ''), NULLIF(email, ''), 'System')
  INTO _actor_admin_id, _actor_name
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _actor_admin_id IS NULL THEN
    SELECT id, COALESCE(NULLIF(full_name, ''), NULLIF(email, ''), 'Unknown agent')
    INTO _actor_admin_id, _actor_name
    FROM public.admin_users
    WHERE id = NEW.assigned_to
    LIMIT 1;
  END IF;

  IF _actor_admin_id IS NULL THEN
    RETURN NEW; -- can't attribute; skip
  END IF;

  _note := 'Status changed: ' ||
           COALESCE(OLD.status, '—') || ' → ' || COALESCE(NEW.status, '—') ||
           ' by ' || _actor_name ||
           ' on ' || to_char(now() AT TIME ZONE 'Europe/London', 'DD Mon YYYY HH24:MI');

  INSERT INTO public.lead_quick_notes (lead_id, note_text, created_by, is_pinned)
  VALUES (NEW.id, _note, _actor_admin_id, false);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_status_change_note ON public.sales_leads;
CREATE TRIGGER trg_log_lead_status_change_note
AFTER UPDATE OF status ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_status_change_note();