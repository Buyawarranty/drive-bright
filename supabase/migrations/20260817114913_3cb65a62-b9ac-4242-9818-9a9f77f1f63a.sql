-- Guard flag so the two triggers never bounce changes back and forth
CREATE OR REPLACE FUNCTION public.rota_sync_in_progress()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT coalesce(current_setting('app.rota_sync', true), 'off') = 'on' $$;

-- agent_working_days -> staff_timesheets
CREATE OR REPLACE FUNCTION public.sync_working_day_to_timesheet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_admin_id uuid;
  v_date date;
  v_hours numeric;
BEGIN
  IF public.rota_sync_in_progress() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_admin_id := COALESCE(NEW.admin_user_id, OLD.admin_user_id);
  v_date := COALESCE(NEW.work_date, OLD.work_date);

  SELECT user_id INTO v_user_id FROM public.admin_users WHERE id = v_admin_id;
  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM set_config('app.rota_sync', 'on', true);

  IF TG_OP = 'DELETE' OR NEW.day_type = 'off' THEN
    -- Remove only auto-derived working entries; leave absences (sick/holiday/etc.) alone
    DELETE FROM public.staff_timesheets
    WHERE user_id = v_user_id
      AND entry_date = v_date
      AND entry_type = 'worked';
  ELSE
    v_hours := CASE WHEN NEW.day_type = 'half_day' THEN 4 ELSE 8 END;

    IF EXISTS (
      SELECT 1 FROM public.staff_timesheets
      WHERE user_id = v_user_id AND entry_date = v_date
        AND entry_type IN ('sick', 'holiday', 'unpaid_leave')
    ) THEN
      PERFORM set_config('app.rota_sync', 'off', true);
      RETURN COALESCE(NEW, OLD);
    END IF;

    INSERT INTO public.staff_timesheets (user_id, admin_user_id, entry_date, entry_type, hours_worked)
    VALUES (v_user_id, v_admin_id, v_date, 'worked', v_hours)
    ON CONFLICT (user_id, entry_date) DO UPDATE
      SET hours_worked = EXCLUDED.hours_worked,
          admin_user_id = COALESCE(public.staff_timesheets.admin_user_id, EXCLUDED.admin_user_id),
          entry_type = CASE
            WHEN public.staff_timesheets.entry_type IN ('worked', 'wfh', 'training')
              THEN public.staff_timesheets.entry_type
            ELSE EXCLUDED.entry_type
          END,
          updated_at = now();
  END IF;

  PERFORM set_config('app.rota_sync', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_working_day_to_timesheet ON public.agent_working_days;
CREATE TRIGGER trg_sync_working_day_to_timesheet
AFTER INSERT OR UPDATE OR DELETE ON public.agent_working_days
FOR EACH ROW EXECUTE FUNCTION public.sync_working_day_to_timesheet();

-- staff_timesheets -> agent_working_days
CREATE OR REPLACE FUNCTION public.sync_timesheet_to_working_day()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_date date;
  v_day_type text;
BEGIN
  IF public.rota_sync_in_progress() THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_date := COALESCE(NEW.entry_date, OLD.entry_date);
  v_admin_id := COALESCE(NEW.admin_user_id, OLD.admin_user_id);
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.admin_users
    WHERE user_id = COALESCE(NEW.user_id, OLD.user_id) LIMIT 1;
  END IF;
  IF v_admin_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  PERFORM set_config('app.rota_sync', 'on', true);

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.agent_working_days
    WHERE admin_user_id = v_admin_id AND work_date = v_date;
  ELSE
    v_day_type := CASE
      WHEN NEW.entry_type IN ('sick', 'holiday', 'unpaid_leave') THEN 'off'
      WHEN COALESCE(NEW.hours_worked, 0) > 0 AND COALESCE(NEW.hours_worked, 0) <= 5 THEN 'half_day'
      ELSE 'full_day'
    END;

    INSERT INTO public.agent_working_days (admin_user_id, work_date, day_type, created_by)
    VALUES (v_admin_id, v_date, v_day_type, NEW.user_id)
    ON CONFLICT (admin_user_id, work_date) DO UPDATE
      SET day_type = EXCLUDED.day_type, updated_at = now();
  END IF;

  PERFORM set_config('app.rota_sync', 'off', true);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_timesheet_to_working_day ON public.staff_timesheets;
CREATE TRIGGER trg_sync_timesheet_to_working_day
AFTER INSERT OR UPDATE OR DELETE ON public.staff_timesheets
FOR EACH ROW EXECUTE FUNCTION public.sync_timesheet_to_working_day();