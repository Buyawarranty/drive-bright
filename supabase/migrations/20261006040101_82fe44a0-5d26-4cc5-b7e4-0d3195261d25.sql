CREATE OR REPLACE FUNCTION public.get_lead_quick_note_counts(p_lead_ids uuid[])
 RETURNS TABLE(lead_id uuid, note_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT lead_id, COUNT(*)::bigint AS note_count
  FROM public.lead_quick_notes
  WHERE lead_id = ANY(p_lead_ids)
    AND note_text !~ '^\[.+ — .+\]'
    AND note_text !~* '^(📞|📵).*via Dial 9'
    AND note_text !~* '^Status changed: .+ by .+ on '
  GROUP BY lead_id;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_sales_lead_call_count(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  v_created_at timestamptz;
  v_window_end timestamptz;
  v_count integer;
  v_adj integer;
BEGIN
  SELECT RIGHT(public.normalize_uk_phone(phone), 9), created_at, COALESCE(manual_call_adjustment, 0)
    INTO v_tail, v_created_at, v_adj
  FROM public.sales_leads
  WHERE id = p_lead_id
    AND phone IS NOT NULL AND btrim(phone) <> '';

  IF v_tail IS NULL OR length(v_tail) < 9 THEN
    RETURN;
  END IF;

  SELECT MIN(created_at) INTO v_window_end
  FROM public.sales_leads
  WHERE id <> p_lead_id
    AND phone IS NOT NULL AND btrim(phone) <> ''
    AND RIGHT(public.normalize_uk_phone(phone), 9) = v_tail
    AND created_at > v_created_at;

  WITH zoiper AS (
    SELECT date_trunc('minute', COALESCE(started_at, created_at)) AS bucket
    FROM public.zoiper_call_events
    WHERE direction = 'outbound'
      AND dialed_number IS NOT NULL
      AND RIGHT(regexp_replace(dialed_number, '[^0-9]', '', 'g'), 9) = v_tail
      AND COALESCE(started_at, created_at) >= v_created_at
      AND (v_window_end IS NULL OR COALESCE(started_at, created_at) < v_window_end)
    GROUP BY 1
  ),
  clicks AS (
    SELECT date_trunc('minute', created_at) AS bucket
    FROM public.phone_events
    WHERE event_type = 'phone_clicked'
      AND phone_number IS NOT NULL
      AND RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 9) = v_tail
      AND created_at >= v_created_at
      AND (v_window_end IS NULL OR created_at < v_window_end)
    GROUP BY 1
  ),
  merged AS (
    SELECT bucket FROM zoiper
    UNION
    SELECT bucket FROM clicks
  )
  SELECT COUNT(*) INTO v_count FROM merged;

  v_count := GREATEST(COALESCE(v_count, 0) + COALESCE(v_adj, 0), 0);

  UPDATE public.sales_leads
    SET call_count = v_count
  WHERE id = p_lead_id
    AND COALESCE(call_count, 0) <> v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_sales_leads_recompute_call_count_on_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  r record;
BEGIN
  IF NEW.phone IS NULL OR btrim(NEW.phone) = '' THEN
    RETURN NEW;
  END IF;

  v_tail := RIGHT(public.normalize_uk_phone(NEW.phone), 9);
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

CREATE TRIGGER trg_sales_leads_recompute_call_count_on_insert
AFTER INSERT ON public.sales_leads
FOR EACH ROW
EXECUTE FUNCTION public.trg_sales_leads_recompute_call_count_on_insert();