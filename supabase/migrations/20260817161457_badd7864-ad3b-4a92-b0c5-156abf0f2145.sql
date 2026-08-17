-- Tag used for missed inbound calls
INSERT INTO public.lead_tags (name, color, description)
SELECT 'Call back urgent', '#DC2626', 'Missed inbound call (Zoiper / Dial 9 / CallRail) - call back now'
WHERE NOT EXISTS (SELECT 1 FROM public.lead_tags WHERE lower(name) = 'call back urgent');

CREATE OR REPLACE FUNCTION public.auto_create_lead_from_missed_call()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text;
  v_tail9 text;
  v_tag_id uuid;
  v_lead_id uuid;
  v_existing record;
  v_email text;
  v_raw_name text;
  v_first text;
  v_last text;
BEGIN
  -- Only genuine missed / unanswered calls
  IF coalesce(lower(NEW.call_status), 'missed') NOT IN ('missed', 'no-answer', 'noanswer', 'no_answer', 'voicemail', 'busy', 'failed') THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_tag_id FROM public.lead_tags WHERE lower(name) = 'call back urgent' LIMIT 1;

  v_digits := regexp_replace(coalesce(NEW.caller_phone, ''), '\D', '', 'g');
  v_tail9 := right(v_digits, 9);

  -- Already linked to a lead? Just tag it.
  IF NEW.matched_lead_id IS NOT NULL THEN
    v_lead_id := NEW.matched_lead_id;
  ELSIF length(v_tail9) = 9 THEN
    SELECT id, status INTO v_existing
    FROM public.sales_leads
    WHERE phone IS NOT NULL
      AND right(regexp_replace(phone, '\D', '', 'g'), 9) = v_tail9
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
      -- Never resurrect terminal leads
      IF v_existing.status IN ('converted', 'lost', 'fake_lead', 'do_not_contact', 'unsubscribed') THEN
        RETURN NEW;
      END IF;
      v_lead_id := v_existing.id;
    END IF;
  END IF;

  IF v_lead_id IS NULL THEN
    IF length(v_digits) < 7 THEN
      RETURN NEW; -- withheld / unusable number
    END IF;

    v_raw_name := nullif(btrim(coalesce(NEW.caller_name, '')), '');
    IF v_raw_name IS NOT NULL AND lower(v_raw_name) IN ('unavailable', 'unknown', 'withheld') THEN
      v_raw_name := NULL;
    END IF;
    v_first := coalesce(split_part(v_raw_name, ' ', 1), NULL);
    IF v_raw_name IS NOT NULL AND position(' ' in v_raw_name) > 0 THEN
      v_last := btrim(substring(v_raw_name from position(' ' in v_raw_name) + 1));
    END IF;

    v_email := 'missed-call-' || v_digits || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '@buyawarranty.internal';

    INSERT INTO public.sales_leads (email, first_name, last_name, phone, status, lead_source, notes, manual_entry)
    VALUES (
      v_email,
      v_first,
      v_last,
      NEW.caller_phone,
      'urgent_callback',
      'phone',
      'Missed call (' || NEW.provider || ')' ||
        coalesce(' on ' || NEW.tracking_number, '') ||
        ' at ' || to_char(coalesce(NEW.call_started_at, NEW.created_at), 'DD Mon YYYY HH24:MI') ||
        '. Call back urgent.',
      false
    )
    RETURNING id INTO v_lead_id;

    UPDATE public.missed_calls SET matched_lead_id = v_lead_id WHERE id = NEW.id;
  END IF;

  IF v_tag_id IS NOT NULL AND v_lead_id IS NOT NULL THEN
    INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
    SELECT v_lead_id, v_tag_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_tag_assignments WHERE lead_id = v_lead_id AND tag_id = v_tag_id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_create_lead_from_missed_call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_lead_from_missed_call ON public.missed_calls;
CREATE TRIGGER trg_auto_create_lead_from_missed_call
AFTER INSERT ON public.missed_calls
FOR EACH ROW EXECUTE FUNCTION public.auto_create_lead_from_missed_call();