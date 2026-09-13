CREATE TABLE IF NOT EXISTS public.whatsapp_auto_message_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  template_name text NOT NULL DEFAULT 'james_hi',
  template_language text NOT NULL DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.whatsapp_auto_message_settings TO authenticated;
GRANT ALL ON public.whatsapp_auto_message_settings TO service_role;
ALTER TABLE public.whatsapp_auto_message_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can view whatsapp auto settings" ON public.whatsapp_auto_message_settings;
CREATE POLICY "Management can view whatsapp auto settings"
  ON public.whatsapp_auto_message_settings FOR SELECT TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()));

DROP POLICY IF EXISTS "Management can change whatsapp auto settings" ON public.whatsapp_auto_message_settings;
CREATE POLICY "Management can change whatsapp auto settings"
  ON public.whatsapp_auto_message_settings FOR UPDATE TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()))
  WITH CHECK (public.can_manage_lead_routing(auth.uid()));

DROP TRIGGER IF EXISTS update_whatsapp_auto_message_settings_updated_at ON public.whatsapp_auto_message_settings;
CREATE TRIGGER update_whatsapp_auto_message_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_auto_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.whatsapp_auto_message_settings (is_enabled, template_name, template_language)
SELECT true, 'james_hi', 'en'
WHERE NOT EXISTS (SELECT 1 FROM public.whatsapp_auto_message_settings);

CREATE TABLE IF NOT EXISTS public.whatsapp_auto_message_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  phone_normalized text NOT NULL,
  display_name text,
  status text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  conversation_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_auto_message_queue_status_check CHECK (status IN ('pending','sent','failed','skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_auto_queue_lead ON public.whatsapp_auto_message_queue (lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_auto_queue_pending
  ON public.whatsapp_auto_message_queue (status, next_attempt_at) WHERE status = 'pending';

GRANT SELECT ON public.whatsapp_auto_message_queue TO authenticated;
GRANT ALL ON public.whatsapp_auto_message_queue TO service_role;
ALTER TABLE public.whatsapp_auto_message_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can view whatsapp auto queue" ON public.whatsapp_auto_message_queue;
CREATE POLICY "Management can view whatsapp auto queue"
  ON public.whatsapp_auto_message_queue FOR SELECT TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()));

DROP TRIGGER IF EXISTS update_whatsapp_auto_message_queue_updated_at ON public.whatsapp_auto_message_queue;
CREATE TRIGGER update_whatsapp_auto_message_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_auto_message_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.queue_whatsapp_auto_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  digits text;
  normalised text;
  enabled boolean;
BEGIN
  SELECT is_enabled INTO enabled FROM public.whatsapp_auto_message_settings LIMIT 1;
  IF enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  digits := regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  IF length(digits) < 10 THEN
    RETURN NEW;
  END IF;

  IF left(digits, 2) = '44' THEN
    normalised := digits;
  ELSIF left(digits, 1) = '0' THEN
    normalised := '44' || substring(digits from 2);
  ELSE
    normalised := '44' || digits;
  END IF;

  IF left(normalised, 3) <> '447' OR length(normalised) <> 12 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.whatsapp_auto_message_queue (lead_id, phone_normalized, display_name)
  VALUES (
    NEW.id,
    normalised,
    NULLIF(trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), '')
  )
  ON CONFLICT (lead_id) DO NOTHING;

  PERFORM net.http_post(
    url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/wati-auto-message',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
    body := '{"source":"lead_trigger"}'::jsonb
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_whatsapp_auto_message ON public.sales_leads;
CREATE TRIGGER trg_queue_whatsapp_auto_message
  AFTER INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.queue_whatsapp_auto_message();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'retry-whatsapp-auto-messages-hourly') THEN
    PERFORM cron.unschedule('retry-whatsapp-auto-messages-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'retry-whatsapp-auto-messages-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mzlpuxzwyrcyrgrongeb.supabase.co/functions/v1/wati-auto-message',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16bHB1eHp3eXJjeXJncm9uZ2ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4ODc0MjUsImV4cCI6MjA2NjQ2MzQyNX0.bFu0Zj4ic61GN0LwipkINg9YJtgd8RnMgEmzE139MPU"}'::jsonb,
    body := '{"source":"hourly_retry"}'::jsonb
  ) WHERE EXISTS (
    SELECT 1 FROM public.whatsapp_auto_message_queue
    WHERE status = 'pending' AND next_attempt_at <= now()
  );
  $$
);