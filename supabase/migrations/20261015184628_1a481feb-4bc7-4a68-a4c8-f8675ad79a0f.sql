CREATE OR REPLACE FUNCTION public.validate_career_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('new','shortlisted','interview','hired','rejected','on_hold') THEN
    RAISE EXCEPTION 'Invalid career application status: %', NEW.status;
  END IF;

  -- Stamp the 3-working-day rejection deadline on insert
  IF TG_OP = 'INSERT' AND NEW.rejection_due_at IS NULL THEN
    NEW.rejection_due_at := public.add_working_days(COALESCE(NEW.applied_at, now()), 3);
  END IF;

  RETURN NEW;
END;
$$;