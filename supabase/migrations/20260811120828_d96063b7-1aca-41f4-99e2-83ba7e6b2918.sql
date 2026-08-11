-- Prevent duplicate welcome SMS being queued for the same customer
CREATE OR REPLACE FUNCTION public.dedupe_scheduled_sms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tail text := right(regexp_replace(coalesce(NEW.phone,''), '\D', '', 'g'), 9);
  v_exists boolean;
BEGIN
  IF length(v_tail) < 9 THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.scheduled_sms s
    WHERE right(regexp_replace(coalesce(s.phone,''), '\D', '', 'g'), 9) = v_tail
      AND s.created_at > now() - interval '30 days'
  ) INTO v_exists;

  IF v_exists THEN
    RAISE NOTICE 'Skipping duplicate scheduled SMS for %', NEW.phone;
    RETURN NULL; -- silently drop the duplicate
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dedupe_scheduled_sms ON public.scheduled_sms;
CREATE TRIGGER trg_dedupe_scheduled_sms
BEFORE INSERT ON public.scheduled_sms
FOR EACH ROW EXECUTE FUNCTION public.dedupe_scheduled_sms();