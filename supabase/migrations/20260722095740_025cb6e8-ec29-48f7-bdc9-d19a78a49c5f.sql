
-- Make sales_leads.call_count a derived value from real Dial 9 / Zoiper telephony
-- so it can never over- or under-count. Manual +/- writes stop touching it.

CREATE OR REPLACE FUNCTION public.recompute_sales_lead_call_count(p_lead_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT COUNT(DISTINCT external_call_id)
    INTO v_count
  FROM public.zoiper_call_events
  WHERE direction = 'outbound'
    AND dialed_number IS NOT NULL
    AND RIGHT(regexp_replace(dialed_number, '[^0-9]', '', 'g'), 9) = v_tail;

  UPDATE public.sales_leads
    SET call_count = COALESCE(v_count, 0)
  WHERE id = p_lead_id
    AND COALESCE(call_count, 0) <> COALESCE(v_count, 0);
END;
$$;

-- Trigger: when a new telephony event lands, recompute for any matched lead(s).
CREATE OR REPLACE FUNCTION public.trg_zoiper_recompute_lead_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tail text;
  r record;
BEGIN
  IF NEW.direction <> 'outbound' OR NEW.dialed_number IS NULL THEN
    RETURN NEW;
  END IF;

  v_tail := RIGHT(regexp_replace(NEW.dialed_number, '[^0-9]', '', 'g'), 9);
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
$$;

DROP TRIGGER IF EXISTS trg_zoiper_events_recompute_call_count ON public.zoiper_call_events;
CREATE TRIGGER trg_zoiper_events_recompute_call_count
AFTER INSERT ON public.zoiper_call_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_zoiper_recompute_lead_count();

-- Backfill: recompute every sales_lead's call_count from real telephony history.
UPDATE public.sales_leads sl
SET call_count = COALESCE(t.cnt, 0)
FROM (
  SELECT sl2.id AS lead_id, COUNT(DISTINCT zce.external_call_id) AS cnt
  FROM public.sales_leads sl2
  LEFT JOIN public.zoiper_call_events zce
    ON zce.direction = 'outbound'
   AND zce.dialed_number IS NOT NULL
   AND RIGHT(regexp_replace(zce.dialed_number, '[^0-9]', '', 'g'), 9) =
       RIGHT(public.normalize_uk_phone(sl2.phone), 9)
  WHERE sl2.phone IS NOT NULL AND btrim(sl2.phone) <> ''
  GROUP BY sl2.id
) t
WHERE sl.id = t.lead_id
  AND COALESCE(sl.call_count, 0) <> COALESCE(t.cnt, 0);

-- Zero out leads that have no phone or no matching calls but still show a count.
UPDATE public.sales_leads
SET call_count = 0
WHERE call_count > 0
  AND (phone IS NULL OR btrim(phone) = '');
