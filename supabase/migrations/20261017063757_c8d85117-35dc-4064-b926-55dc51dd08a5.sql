GRANT SELECT, UPDATE ON public.career_applications TO authenticated;
GRANT ALL ON public.career_applications TO service_role;

CREATE TABLE public.career_rejection_settings (
 id boolean PRIMARY KEY DEFAULT true,
 rejection_days integer NOT NULL DEFAULT 5,
 sweep_lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.career_rejection_settings TO authenticated;
GRANT ALL ON public.career_rejection_settings TO service_role;
ALTER TABLE public.career_rejection_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read careers settings" ON public.career_rejection_settings FOR SELECT TO authenticated USING (public.is_active_admin_user((SELECT auth.uid())));
CREATE POLICY "Management inserts careers settings" ON public.career_rejection_settings FOR INSERT TO authenticated WITH CHECK (public.is_management((SELECT auth.uid())));
CREATE POLICY "Management updates careers settings" ON public.career_rejection_settings FOR UPDATE TO authenticated USING (public.is_management((SELECT auth.uid()))) WITH CHECK (public.is_management((SELECT auth.uid())));
CREATE OR REPLACE FUNCTION public.validate_career_rejection_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.id IS NOT TRUE OR NEW.rejection_days < 1 OR NEW.rejection_days > 90 THEN RAISE EXCEPTION 'Rejection delay must be between 1 and 90 working days'; END IF;
 IF auth.role() = 'authenticated' AND (TG_OP = 'INSERT' OR NEW.sweep_lease_until IS DISTINCT FROM OLD.sweep_lease_until) AND NEW.sweep_lease_until IS NOT NULL THEN RAISE EXCEPTION 'Sweep lease is managed by the rejection service'; END IF;
 NEW.updated_at := now(); RETURN NEW;
END; $$;
CREATE TRIGGER validate_career_rejection_settings BEFORE INSERT OR UPDATE ON public.career_rejection_settings FOR EACH ROW EXECUTE FUNCTION public.validate_career_rejection_settings();
CREATE OR REPLACE FUNCTION public.validate_career_application() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE days integer;
BEGIN
 IF NEW.status NOT IN ('new','shortlisted','interview','hired','rejected','on_hold') THEN RAISE EXCEPTION 'Invalid career application status: %', NEW.status; END IF;
 IF TG_OP='INSERT' AND NEW.rejection_due_at IS NULL THEN
  SELECT rejection_days INTO days FROM public.career_rejection_settings WHERE id=true;
  NEW.rejection_due_at := public.add_working_days(COALESCE(NEW.applied_at,now()), COALESCE(days,5));
 END IF;
 RETURN NEW;
END; $$;
CREATE OR REPLACE FUNCTION public.delay_career_applications(_ids uuid[], _days integer DEFAULT 5) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF NOT public.is_management((SELECT auth.uid())) THEN RAISE EXCEPTION 'Management access required'; END IF;
 IF _days IS NULL OR _days < 1 OR _days > 90 THEN RAISE EXCEPTION 'Delay must be between 1 and 90 working days'; END IF;
 UPDATE public.career_applications SET status='new', auto_reject_enabled=true, rejection_due_at=public.add_working_days(now(),_days), decided_at=NULL, decided_by=NULL WHERE id=ANY(_ids) AND rejection_sent_at IS NULL AND status IN ('new','on_hold');
 GET DIAGNOSTICS affected=ROW_COUNT; RETURN affected;
END; $$;
REVOKE ALL ON FUNCTION public.delay_career_applications(uuid[],integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delay_career_applications(uuid[],integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.acquire_career_rejection_lease() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acquired boolean;
BEGIN
 INSERT INTO public.career_rejection_settings(id,sweep_lease_until) VALUES(true,now()+interval '10 minutes') ON CONFLICT(id) DO UPDATE SET sweep_lease_until=EXCLUDED.sweep_lease_until WHERE career_rejection_settings.sweep_lease_until IS NULL OR career_rejection_settings.sweep_lease_until < now() RETURNING true INTO acquired;
 RETURN COALESCE(acquired,false);
END; $$;
REVOKE ALL ON FUNCTION public.acquire_career_rejection_lease() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_career_rejection_lease() TO service_role;