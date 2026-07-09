CREATE OR REPLACE FUNCTION public.log_lead_status_change_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_admin_id uuid;
  _actor_name text;
  _note text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT id,
         COALESCE(
           NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
           NULLIF(email, ''),
           'System'
         )
  INTO _actor_admin_id, _actor_name
  FROM public.admin_users
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF _actor_admin_id IS NULL THEN
    SELECT id,
           COALESCE(
             NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''),
             NULLIF(email, ''),
             'Unknown agent'
           )
    INTO _actor_admin_id, _actor_name
    FROM public.admin_users
    WHERE id = NEW.assigned_to
    LIMIT 1;
  END IF;

  IF _actor_admin_id IS NULL THEN
    RETURN NEW;
  END IF;

  _note := 'Status changed: ' ||
           COALESCE(OLD.status, '—') || ' → ' || COALESCE(NEW.status, '—') ||
           ' by ' || _actor_name ||
           ' on ' || to_char(now() AT TIME ZONE 'Europe/London', 'DD Mon YYYY HH24:MI');

  BEGIN
    INSERT INTO public.lead_quick_notes (lead_id, note_text, created_by, is_pinned)
    VALUES (NEW.id, _note, _actor_admin_id, false);
  EXCEPTION WHEN OTHERS THEN
    -- Never block the underlying update if note logging fails
    NULL;
  END;

  RETURN NEW;
END;
$$;