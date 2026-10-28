-- Rapid lead-opening alert (staff access & security log).
--
-- security_alerts: admin-only notices naming the person, what they did and the
--   breakdown, so a Live Alerts card and the email always tell the same story.
-- lead_opening_rate_settings: the one editable rule row (limit, window, who
--   gets told). Defaults to the agreed 30 openings in 10 minutes, emailed to
--   info@ and support@.
-- lead_opening_rate_wakes: remembers who was last checked so a fast clicker
--   cannot make the system run the same check over and over.
CREATE TABLE public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind ~ '^[a-z0-9_]{1,48}$'),
  actor_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  dismissed_at timestamptz
);
CREATE INDEX security_alerts_kind_time_idx ON public.security_alerts(kind, created_at DESC);
CREATE INDEX security_alerts_actor_time_idx ON public.security_alerts(actor_id, created_at DESC);
GRANT SELECT ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Admins and super admins only: the same predicate as the lead access history,
-- so a sales agent can never read the log that would name their own manager.
CREATE POLICY "Admins review security alerts" ON public.security_alerts FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')));
CREATE POLICY "Admins close security alerts" ON public.security_alerts FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')));

CREATE TABLE public.lead_opening_rate_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  threshold integer NOT NULL DEFAULT 30 CHECK (threshold BETWEEN 1 AND 500),
  window_minutes integer NOT NULL DEFAULT 10 CHECK (window_minutes BETWEEN 1 AND 180),
  alert_emails text[] NOT NULL DEFAULT ARRAY['info@buyawarranty.co.uk','support@buyawarranty.co.uk']::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.lead_opening_rate_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.lead_opening_rate_settings TO authenticated;
GRANT ALL ON public.lead_opening_rate_settings TO service_role;
ALTER TABLE public.lead_opening_rate_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read the opening rate rule" ON public.lead_opening_rate_settings FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')));
CREATE POLICY "Admins edit the opening rate rule" ON public.lead_opening_rate_settings FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')));

CREATE TABLE public.lead_opening_rate_wakes (
  actor_id uuid PRIMARY KEY REFERENCES public.admin_users(id) ON DELETE CASCADE,
  woken_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lead_opening_rate_wakes TO service_role;
ALTER TABLE public.lead_opening_rate_wakes ENABLE ROW LEVEL SECURITY;

-- Wakes the check only when it can actually matter: this person has now opened
-- at least the limit in the window, and has not been checked in the last two
-- minutes. Nothing runs on a timer, and a failure here never stops a lead
-- opening from being recorded.
CREATE OR REPLACE FUNCTION public.wake_lead_opening_rate_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_enabled boolean;
  v_threshold integer;
  v_window integer;
  v_count bigint;
BEGIN
  SELECT enabled, threshold, window_minutes INTO v_enabled, v_threshold, v_window
  FROM public.lead_opening_rate_settings WHERE id = true;
  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lead_access_events
  WHERE actor_id = NEW.actor_id
    AND occurred_at >= now() - make_interval(mins => v_window);
  IF v_count < v_threshold THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.lead_opening_rate_wakes w
    WHERE w.actor_id = NEW.actor_id AND w.woken_at > now() - interval '2 minutes'
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.lead_opening_rate_wakes (actor_id, woken_at)
  VALUES (NEW.actor_id, now())
  ON CONFLICT (actor_id) DO UPDATE SET woken_at = now();

  PERFORM net.http_post(
    url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/lead-opening-rate-alert',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
    body := json_build_object('actor_id', NEW.actor_id, 'opened', v_count)::text
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS lead_access_events_wake_rate_check ON public.lead_access_events;
CREATE TRIGGER lead_access_events_wake_rate_check
AFTER INSERT ON public.lead_access_events
FOR EACH ROW EXECUTE FUNCTION public.wake_lead_opening_rate_check();
