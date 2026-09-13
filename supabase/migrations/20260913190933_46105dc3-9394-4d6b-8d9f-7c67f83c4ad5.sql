CREATE OR REPLACE FUNCTION public.queue_whatsapp_auto_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  digits text;
  normalised text;
  enabled boolean;
BEGIN
  IF NEW.status::text IN ('fake_lead','do_not_contact','unsubscribed') THEN
    RETURN NEW;
  END IF;

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
$function$;