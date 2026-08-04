CREATE OR REPLACE FUNCTION public.sync_sibling_lead_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tail text;
  v_email text;
  r RECORD;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to THEN
    RETURN NEW;
  END IF;

  -- Guard against recursive propagation
  IF current_setting('baw.sibling_owner_sync', true) = 'on' THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('baw.sibling_owner_sync', 'on', true);

  v_tail := NULLIF(RIGHT(COALESCE(public.normalize_uk_phone(NEW.phone), ''), 9), '');
  v_email := NULLIF(lower(btrim(COALESCE(NEW.email, ''))), '');

  IF v_tail IS NULL AND v_email IS NULL THEN
    PERFORM set_config('baw.sibling_owner_sync', 'off', true);
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT sl.id, sl.assigned_to, COALESCE(sl.call_count, 0) AS call_count
    FROM public.sales_leads sl
    WHERE sl.id <> NEW.id
      AND sl.status NOT IN ('lost','fake_lead','converted','do_not_contact','archived')
      AND COALESCE(sl.assigned_to::text,'') <> COALESCE(NEW.assigned_to::text,'')
      AND (
        (v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,''))) = v_email)
        OR (v_tail IS NOT NULL AND sl.phone IS NOT NULL AND btrim(sl.phone) <> ''
            AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''), 9) = v_tail)
      )
  LOOP
    IF r.call_count = 0 THEN
      -- Untouched duplicate: move it to the same owner so only one agent calls
      UPDATE public.sales_leads
         SET assigned_to = NEW.assigned_to,
             owner_agent = NEW.assigned_to,
             assigned_at = now(),
             auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['same_customer_sticky','duplicate_customer'])))
       WHERE id = r.id;

      BEGIN
        INSERT INTO public.lead_assignment_audit (lead_id, assigned_to_id, assigned_by, assignment_type, reason)
        VALUES (r.id, NEW.assigned_to, NULL, 'same_customer_sticky',
                format('Duplicate enquiry from same customer as lead %s → owner aligned so only one agent calls', NEW.id));
      EXCEPTION WHEN OTHERS THEN NULL; END;
    ELSE
      -- Both sides already worked: don't steal history, flag it for managers
      UPDATE public.sales_leads
         SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['duplicate_customer','mgr_alert_duplicate_split_owner'])))
       WHERE id = r.id;

      UPDATE public.sales_leads
         SET auto_tags = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags, ARRAY[]::text[]) || ARRAY['duplicate_customer','mgr_alert_duplicate_split_owner'])))
       WHERE id = NEW.id;
    END IF;
  END LOOP;

  PERFORM set_config('baw.sibling_owner_sync', 'off', true);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_sibling_lead_owner ON public.sales_leads;
CREATE TRIGGER trg_sync_sibling_lead_owner
AFTER UPDATE OF assigned_to ON public.sales_leads
FOR EACH ROW EXECUTE FUNCTION public.sync_sibling_lead_owner();