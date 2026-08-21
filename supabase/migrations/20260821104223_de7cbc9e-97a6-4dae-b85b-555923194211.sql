-- ============================================================
-- Working-day helper: add N working days to a timestamp,
-- skipping Sat/Sun and any date in uk_bank_holidays.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_working_days(_from timestamptz, _days integer)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (_from AT TIME ZONE 'Europe/London')::date;
  remaining integer := GREATEST(COALESCE(_days, 0), 0);
BEGIN
  WHILE remaining > 0 LOOP
    d := d + 1;
    IF EXTRACT(ISODOW FROM d) < 6
       AND NOT EXISTS (SELECT 1 FROM public.uk_bank_holidays h WHERE h.holiday_date = d) THEN
      remaining := remaining - 1;
    END IF;
  END LOOP;
  -- 09:00 London on the due working day
  RETURN (d::text || ' 09:00')::timestamp AT TIME ZONE 'Europe/London';
END;
$$;

-- ============================================================
-- Careers applications
-- ============================================================
CREATE TABLE public.career_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone text,
  role_applied text NOT NULL DEFAULT 'Vehicle Warranty Sales Executive',
  covering_note text,
  cv_file_name text,
  cv_storage_path text,
  status text NOT NULL DEFAULT 'new',
  applied_at timestamptz NOT NULL DEFAULT now(),
  rejection_due_at timestamptz,
  acknowledgement_sent_at timestamptz,
  rejection_sent_at timestamptz,
  auto_reject_enabled boolean NOT NULL DEFAULT true,
  decided_by uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  internal_notes text,
  source_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.career_applications TO authenticated;
GRANT ALL ON public.career_applications TO service_role;

ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff can view career applications"
ON public.career_applications FOR SELECT TO authenticated
USING (public.is_active_admin_user((select auth.uid())));

CREATE POLICY "Admin staff can update career applications"
ON public.career_applications FOR UPDATE TO authenticated
USING (public.is_active_admin_user((select auth.uid())))
WITH CHECK (public.is_active_admin_user((select auth.uid())));

CREATE POLICY "Admins can delete career applications"
ON public.career_applications FOR DELETE TO authenticated
USING (public.is_admin((select auth.uid())));

CREATE INDEX idx_career_applications_status ON public.career_applications (status, rejection_due_at);
CREATE INDEX idx_career_applications_applied_at ON public.career_applications (applied_at DESC);

-- Validation trigger (status whitelist) instead of a CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_career_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('new','shortlisted','interview','hired','rejected','on_hold') THEN
    RAISE EXCEPTION 'Invalid career application status: %', NEW.status;
  END IF;

  -- Stamp the 5-working-day rejection deadline on insert
  IF TG_OP = 'INSERT' AND NEW.rejection_due_at IS NULL THEN
    NEW.rejection_due_at := public.add_working_days(COALESCE(NEW.applied_at, now()), 5);
  END IF;

  -- Any decision other than "new" permanently stops the auto-rejection clock
  IF TG_OP = 'UPDATE' AND NEW.status <> OLD.status AND NEW.status <> 'new' THEN
    NEW.decided_at := COALESCE(NEW.decided_at, now());
    IF NEW.status <> 'rejected' THEN
      NEW.auto_reject_enabled := false;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_career_application
BEFORE INSERT OR UPDATE ON public.career_applications
FOR EACH ROW EXECUTE FUNCTION public.validate_career_application();