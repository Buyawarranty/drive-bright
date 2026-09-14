-- 1. Snapshot the author's name on every note so it survives staff removal
ALTER TABLE public.lead_quick_notes ADD COLUMN IF NOT EXISTS author_name text;
ALTER TABLE public.lead_quick_notes_backup ADD COLUMN IF NOT EXISTS author_name text;

UPDATE public.lead_quick_notes n
SET author_name = COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.email)
FROM public.admin_users a
WHERE n.created_by = a.id AND n.author_name IS NULL;

CREATE OR REPLACE FUNCTION public.stamp_lead_note_author_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.author_name IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.email)
      INTO NEW.author_name
    FROM public.admin_users a
    WHERE a.id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_lead_note_author_name ON public.lead_quick_notes;
CREATE TRIGGER trg_stamp_lead_note_author_name
BEFORE INSERT ON public.lead_quick_notes
FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_note_author_name();

-- 2. Backup trigger must carry the author name too
CREATE OR REPLACE FUNCTION public.backup_lead_quick_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
begin
  if (tg_op = 'DELETE') then
    insert into public.lead_quick_notes_backup (note_id, lead_id, note_text, is_pinned, created_by, author_name, note_created_at, note_updated_at, operation)
    values (old.id, old.lead_id, old.note_text, old.is_pinned, old.created_by, old.author_name, old.created_at, old.updated_at, 'DELETE');
    return old;
  else
    insert into public.lead_quick_notes_backup (note_id, lead_id, note_text, is_pinned, created_by, author_name, note_created_at, note_updated_at, operation)
    values (new.id, new.lead_id, new.note_text, new.is_pinned, new.created_by, new.author_name, new.created_at, new.updated_at, tg_op);
    return new;
  end if;
end;
$$;

-- 3. Removing a staff member must NEVER delete their lead notes
CREATE OR REPLACE FUNCTION public.delete_admin_user_cascade(p_admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE customers SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE customers SET quote_sent_by = NULL WHERE quote_sent_by = p_admin_user_id;
  UPDATE customers SET payment_confirmed_by = NULL WHERE payment_confirmed_by = p_admin_user_id;
  UPDATE customer_policies SET quote_sent_by = NULL WHERE quote_sent_by = p_admin_user_id;
  UPDATE sales_leads SET assigned_to = NULL WHERE assigned_to = p_admin_user_id;
  UPDATE lead_distribution_settings SET overflow_recipient_id = NULL WHERE overflow_recipient_id = p_admin_user_id;
  UPDATE lead_distribution_settings SET solo_agent_id = NULL WHERE solo_agent_id = p_admin_user_id;
  UPDATE round_robin_state SET last_assigned_user_id = NULL WHERE last_assigned_user_id = p_admin_user_id;
  UPDATE commission_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE deal_records SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE user_activity_log SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE staff_timesheets SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE lead_call_logs SET agent_id = NULL WHERE agent_id = p_admin_user_id;
  UPDATE selling_tips SET created_by = NULL WHERE created_by = p_admin_user_id;
  UPDATE selling_tips SET resolved_by = NULL WHERE resolved_by = p_admin_user_id;
  UPDATE timesheet_bonuses SET admin_user_id = NULL WHERE admin_user_id = p_admin_user_id;
  UPDATE timesheet_bonuses SET reviewed_by = NULL WHERE reviewed_by = p_admin_user_id;
  UPDATE timesheet_comments SET author_id = NULL WHERE author_id = p_admin_user_id;
  UPDATE agent_daily_targets SET set_by = NULL WHERE set_by = p_admin_user_id;
  UPDATE commission_claims SET reviewed_by = NULL WHERE reviewed_by = p_admin_user_id;
  UPDATE lead_activities SET performed_by = NULL WHERE performed_by = p_admin_user_id;
  UPDATE lead_assignment_audit SET assigned_to_id = NULL WHERE assigned_to_id = p_admin_user_id;
  UPDATE lead_tag_assignments SET assigned_by = NULL WHERE assigned_by = p_admin_user_id;
  UPDATE structured_customer_notes SET created_by = NULL WHERE created_by = p_admin_user_id;
  UPDATE structured_customer_notes SET updated_by = NULL WHERE updated_by = p_admin_user_id;
  UPDATE lead_access_requests SET approved_by = NULL WHERE approved_by = p_admin_user_id;

  -- Lead notes are business records: keep the text, keep the author's name,
  -- just detach the staff link.
  UPDATE lead_quick_notes
     SET author_name = COALESCE(author_name, (
           SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.email)
           FROM admin_users a WHERE a.id = p_admin_user_id)),
         created_by = NULL
   WHERE created_by = p_admin_user_id;

  DELETE FROM overflow_recipients WHERE admin_user_id = p_admin_user_id;
  DELETE FROM salesperson_stats WHERE user_id = p_admin_user_id;
  DELETE FROM user_badges WHERE user_id = p_admin_user_id;
  DELETE FROM user_daily_online_time WHERE admin_user_id = p_admin_user_id;
  DELETE FROM timesheet_comments WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_distribution_caps WHERE admin_user_id = p_admin_user_id;
  DELETE FROM agent_daily_targets WHERE agent_id = p_admin_user_id;
  DELETE FROM agent_schedules WHERE admin_user_id = p_admin_user_id;
  DELETE FROM user_presence WHERE admin_user_id = p_admin_user_id;
  DELETE FROM sales_targets WHERE admin_user_id = p_admin_user_id;
  DELETE FROM commission_claims WHERE agent_id = p_admin_user_id;
  DELETE FROM lead_access_requests WHERE requested_by = p_admin_user_id;

  DELETE FROM admin_users WHERE id = p_admin_user_id;
END;
$$;

-- 4. Recovery: put back any note for a lead that exists in the backup but is missing live
CREATE OR REPLACE FUNCTION public.restore_lead_notes_from_backup(p_lead_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_restored integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = (SELECT auth.uid()) AND au.is_active = true
  ) THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (b.note_id)
           b.note_id, b.lead_id, b.note_text, b.is_pinned, b.created_by, b.author_name, b.note_created_at
    FROM lead_quick_notes_backup b
    WHERE b.lead_id = p_lead_id
      AND b.operation <> 'DELETE'
    ORDER BY b.note_id, b.created_at DESC
  ), ins AS (
    INSERT INTO lead_quick_notes (id, lead_id, note_text, is_pinned, created_by, author_name, created_at)
    SELECT l.note_id, l.lead_id, l.note_text, COALESCE(l.is_pinned, false), l.created_by, l.author_name,
           COALESCE(l.note_created_at, now())
    FROM latest l
    WHERE NOT EXISTS (SELECT 1 FROM lead_quick_notes n WHERE n.id = l.note_id)
      AND EXISTS (SELECT 1 FROM sales_leads s WHERE s.id = l.lead_id)
    RETURNING 1
  )
  SELECT count(*) INTO v_restored FROM ins;

  RETURN v_restored;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_lead_notes_from_backup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_lead_notes_from_backup(uuid) TO authenticated;