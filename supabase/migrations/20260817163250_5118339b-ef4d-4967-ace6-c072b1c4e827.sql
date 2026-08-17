CREATE OR REPLACE FUNCTION public.auto_create_lead_from_callrail_call()
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
  v_status text;
  v_is_missed boolean;
BEGIN
  -- Inbound calls only, and only once the call has a settled outcome
  IF coalesce(lower(NEW.direction), 'inbound') <> 'inbound' THEN
    RETURN NEW;
  END IF;

  v_status := lower(coalesce(NEW.status, ''));
  IF v_status IN ('ringing', 'in-progress', 'incoming', 'pre_call', '') THEN
    RETURN NEW;
  END IF;

  -- Already linked to a lead: only ensure the urgent tag for missed calls
  v_is_missed := v_status IN ('missed', 'no-answer', 'noanswer', 'no_answer', 'voicemail', 'busy', 'failed');

  SELECT id INTO v_tag_id FROM public.lead_tags WHERE lower(name) = 'call back urgent' LIMIT 1;

  v_digits := regexp_replace(coalesce(NEW.caller_number, ''), '\D', '', 'g');
  v_tail9 := right(v_digits, 9);

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
      IF v_existing.status IN ('converted', 'lost', 'fake_lead', 'do_not_contact', 'unsubscribed') THEN
        RETURN NEW;
      END IF;
      v_lead_id := v_existing.id;
      UPDATE public.callrail_calls SET matched_lead_id = v_lead_id WHERE id = NEW.id AND matched_lead_id IS NULL;
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
    v_first := nullif(split_part(coalesce(v_raw_name, ''), ' ', 1), '');
    IF v_raw_name IS NOT NULL AND position(' ' in v_raw_name) > 0 THEN
      v_last := btrim(substring(v_raw_name from position(' ' in v_raw_name) + 1));
    END IF;

    v_email := 'callrail-' || v_digits || '-' || to_char(now(), 'YYYYMMDDHH24MISS') || '@buyawarranty.internal';

    INSERT INTO public.sales_leads (email, first_name, last_name, phone, status, lead_source, notes, manual_entry)
    VALUES (
      v_email,
      v_first,
      v_last,
      NEW.caller_number,
      CASE WHEN v_is_missed THEN 'urgent_callback' ELSE 'new' END::lead_status,
      'phone',
      'Inbound CallRail call (' || v_status || ')' ||
        coalesce(' on ' || NEW.tracked_number, '') ||
        ' at ' || to_char(coalesce(NEW.started_at, NEW.created_at), 'DD Mon YYYY HH24:MI') ||
        coalesce(' · ' || NEW.duration_seconds || 's', '') ||
        CASE WHEN v_is_missed THEN '. Call back urgent.' ELSE '' END,
      false
    )
    RETURNING id INTO v_lead_id;

    UPDATE public.callrail_calls SET matched_lead_id = v_lead_id WHERE id = NEW.id;
  END IF;

  IF v_is_missed AND v_tag_id IS NOT NULL AND v_lead_id IS NOT NULL THEN
    INSERT INTO public.lead_tag_assignments (lead_id, tag_id)
    SELECT v_lead_id, v_tag_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.lead_tag_assignments WHERE lead_id = v_lead_id AND tag_id = v_tag_id
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_create_lead_from_callrail_call failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_lead_from_callrail_call ON public.callrail_calls;
CREATE TRIGGER trg_auto_create_lead_from_callrail_call
AFTER INSERT OR UPDATE OF status, matched_lead_id ON public.callrail_calls
FOR EACH ROW EXECUTE FUNCTION public.auto_create_lead_from_callrail_call();