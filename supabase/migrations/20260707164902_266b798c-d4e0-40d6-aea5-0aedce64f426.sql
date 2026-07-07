
CREATE TABLE public.admin_user_access_periods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  started_by UUID,
  ended_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_access_periods_user ON public.admin_user_access_periods(admin_user_id);
CREATE INDEX idx_admin_access_periods_open ON public.admin_user_access_periods(admin_user_id) WHERE end_date IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.admin_user_access_periods TO authenticated;
GRANT ALL ON public.admin_user_access_periods TO service_role;

ALTER TABLE public.admin_user_access_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view access periods"
  ON public.admin_user_access_periods
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins manage access periods"
  ON public.admin_user_access_periods
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.track_admin_user_access_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID;
  v_name TEXT;
BEGIN
  BEGIN
    v_actor := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor := NULL;
  END;

  v_name := NULLIF(TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '');

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_active THEN
      INSERT INTO public.admin_user_access_periods
        (admin_user_id, email, full_name, role, start_date, started_by, reason)
      VALUES
        (NEW.id, NEW.email, COALESCE(v_name, NEW.email), NEW.role::text, COALESCE(NEW.invited_at, now()), v_actor, 'Account created');
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.is_active = true AND NEW.is_active = false THEN
    UPDATE public.admin_user_access_periods
       SET end_date = now(), ended_by = v_actor,
           reason = COALESCE(NULLIF(reason,''),'Active') || ' · Deactivated'
     WHERE admin_user_id = NEW.id AND end_date IS NULL;
  END IF;

  IF OLD.is_active = false AND NEW.is_active = true THEN
    INSERT INTO public.admin_user_access_periods
      (admin_user_id, email, full_name, role, start_date, started_by, reason)
    VALUES
      (NEW.id, NEW.email, COALESCE(v_name, NEW.email), NEW.role::text, now(), v_actor, 'Reactivated');
  END IF;

  IF NEW.is_active = true AND OLD.is_active = true AND OLD.role::text IS DISTINCT FROM NEW.role::text THEN
    UPDATE public.admin_user_access_periods
       SET end_date = now(), ended_by = v_actor,
           reason = COALESCE(NULLIF(reason,''),'Active') || ' · Role changed from ' || OLD.role::text
     WHERE admin_user_id = NEW.id AND end_date IS NULL;

    INSERT INTO public.admin_user_access_periods
      (admin_user_id, email, full_name, role, start_date, started_by, reason)
    VALUES
      (NEW.id, NEW.email, COALESCE(v_name, NEW.email), NEW.role::text, now(), v_actor, 'Role set to ' || NEW.role::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_admin_user_access
AFTER INSERT OR UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.track_admin_user_access_period();

INSERT INTO public.admin_user_access_periods
  (admin_user_id, email, full_name, role, start_date, reason)
SELECT
  au.id,
  au.email,
  NULLIF(TRIM(COALESCE(au.first_name, '') || ' ' || COALESCE(au.last_name, '')), ''),
  au.role::text,
  COALESCE(au.invited_at, au.created_at, now()),
  'Backfilled from existing account'
FROM public.admin_users au
WHERE au.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_user_access_periods p
    WHERE p.admin_user_id = au.id AND p.end_date IS NULL
  );
