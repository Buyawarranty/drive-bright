
CREATE OR REPLACE FUNCTION public.demote_new_status_on_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  BEGIN
    v_lead_id := NEW.lead_id::uuid;
  EXCEPTION WHEN others THEN
    RETURN NEW;
  END;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads
     SET status = 'contacted'::lead_status,
         updated_at = now()
   WHERE id = v_lead_id
     AND status = 'new'::lead_status;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demote_new_on_call ON public.lead_call_logs;
CREATE TRIGGER trg_demote_new_on_call
AFTER INSERT ON public.lead_call_logs
FOR EACH ROW EXECUTE FUNCTION public.demote_new_status_on_touch();

DROP TRIGGER IF EXISTS trg_demote_new_on_note ON public.lead_quick_notes;
CREATE TRIGGER trg_demote_new_on_note
AFTER INSERT ON public.lead_quick_notes
FOR EACH ROW EXECUTE FUNCTION public.demote_new_status_on_touch();

UPDATE public.sales_leads sl
   SET status = 'contacted'::lead_status,
       updated_at = now()
 WHERE sl.status = 'new'::lead_status
   AND (
     EXISTS (SELECT 1 FROM public.lead_call_logs  c WHERE c.lead_id::text = sl.id::text)
     OR EXISTS (SELECT 1 FROM public.lead_quick_notes n WHERE n.lead_id::text = sl.id::text)
   );
