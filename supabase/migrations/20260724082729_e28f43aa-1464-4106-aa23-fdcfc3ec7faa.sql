
-- Include click-to-dial (phone_events.phone_clicked) in the sales_leads.call_count derivation
-- so agent dials update the DIALS counter on the lead row immediately, not just Dial 9 syncs.

CREATE OR REPLACE FUNCTION public.recompute_sales_lead_call_count(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  v_count integer;
BEGIN
  SELECT RIGHT(public.normalize_uk_phone(phone), 9)
    INTO v_tail
  FROM public.sales_leads
  WHERE id = p_lead_id
    AND phone IS NOT NULL AND btrim(phone) <> '';

  IF v_tail IS NULL OR length(v_tail) < 9 THEN
    RETURN;
  END IF;

  -- Union two real dial sources, deduplicated to 1-minute buckets so a
  -- click-to-dial and its Dial 9 sync counterpart count once.
  WITH zoiper AS (
    SELECT date_trunc('minute', COALESCE(started_at, created_at)) AS bucket
    FROM public.zoiper_call_events
    WHERE direction = 'outbound'
      AND dialed_number IS NOT NULL
      AND RIGHT(regexp_replace(dialed_number, '[^0-9]', '', 'g'), 9) = v_tail
    GROUP BY 1
  ),
  clicks AS (
    SELECT date_trunc('minute', created_at) AS bucket
    FROM public.phone_events
    WHERE event_type = 'phone_clicked'
      AND phone_number IS NOT NULL
      AND RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 9) = v_tail
    GROUP BY 1
  ),
  merged AS (
    SELECT bucket FROM zoiper
    UNION
    SELECT bucket FROM clicks
  )
  SELECT COUNT(*) INTO v_count FROM merged;

  UPDATE public.sales_leads
    SET call_count = COALESCE(v_count, 0)
  WHERE id = p_lead_id
    AND COALESCE(call_count, 0) <> COALESCE(v_count, 0);
END;
$function$;

-- New trigger: click-to-dial (phone_events) recomputes matching lead counters.
CREATE OR REPLACE FUNCTION public.trg_phone_events_recompute_lead_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  r record;
BEGIN
  IF NEW.event_type <> 'phone_clicked' OR NEW.phone_number IS NULL THEN
    RETURN NEW;
  END IF;

  v_tail := RIGHT(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), 9);
  IF v_tail IS NULL OR length(v_tail) < 9 THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT id FROM public.sales_leads
    WHERE phone IS NOT NULL AND btrim(phone) <> ''
      AND RIGHT(public.normalize_uk_phone(phone), 9) = v_tail
  LOOP
    PERFORM public.recompute_sales_lead_call_count(r.id);
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_phone_events_recompute_lead_count ON public.phone_events;
CREATE TRIGGER trg_phone_events_recompute_lead_count
AFTER INSERT ON public.phone_events
FOR EACH ROW EXECUTE FUNCTION public.trg_phone_events_recompute_lead_count();

-- Backfill: recompute call_count for leads that had click-to-dial events in the last 30 days.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT sl.id
    FROM public.sales_leads sl
    JOIN public.phone_events pe
      ON pe.event_type = 'phone_clicked'
     AND pe.phone_number IS NOT NULL
     AND RIGHT(regexp_replace(pe.phone_number, '[^0-9]', '', 'g'), 9)
         = RIGHT(public.normalize_uk_phone(sl.phone), 9)
    WHERE sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
      AND pe.created_at > now() - interval '30 days'
  LOOP
    PERFORM public.recompute_sales_lead_call_count(r.id);
  END LOOP;
END $$;
