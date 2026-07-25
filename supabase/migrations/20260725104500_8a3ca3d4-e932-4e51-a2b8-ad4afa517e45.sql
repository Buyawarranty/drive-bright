ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS manual_call_adjustment integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_sales_lead_call_count(p_lead_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  v_count integer;
  v_adj integer;
BEGIN
  SELECT RIGHT(public.normalize_uk_phone(phone), 9), COALESCE(manual_call_adjustment, 0)
    INTO v_tail, v_adj
  FROM public.sales_leads
  WHERE id = p_lead_id
    AND phone IS NOT NULL AND btrim(phone) <> '';

  IF v_tail IS NULL OR length(v_tail) < 9 THEN
    RETURN;
  END IF;

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

  v_count := GREATEST(COALESCE(v_count, 0) + COALESCE(v_adj, 0), 0);

  UPDATE public.sales_leads
    SET call_count = v_count
  WHERE id = p_lead_id
    AND COALESCE(call_count, 0) <> v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.adjust_sales_lead_call_count(p_lead_id uuid, p_delta integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_new integer;
BEGIN
  IF p_delta NOT IN (-1, 1) THEN
    RAISE EXCEPTION 'p_delta must be -1 or 1';
  END IF;

  UPDATE public.sales_leads
    SET manual_call_adjustment = COALESCE(manual_call_adjustment, 0) + p_delta
  WHERE id = p_lead_id;

  PERFORM public.recompute_sales_lead_call_count(p_lead_id);

  -- Leads without a usable phone number never get recomputed; apply directly.
  UPDATE public.sales_leads
    SET call_count = GREATEST(COALESCE(call_count, 0) + p_delta, 0)
  WHERE id = p_lead_id
    AND (phone IS NULL OR length(RIGHT(public.normalize_uk_phone(phone), 9)) < 9);

  SELECT COALESCE(call_count, 0) INTO v_new FROM public.sales_leads WHERE id = p_lead_id;
  RETURN v_new;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.adjust_sales_lead_call_count(uuid, integer) TO authenticated;