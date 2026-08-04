CREATE OR REPLACE FUNCTION public.mark_leads_not_interested_on_unsubscribe()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.frequency, 'off') <> 'off' THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads
  SET status = 'not_interested'::lead_status,
      updated_at = now()
  WHERE lower(trim(email)) = lower(trim(NEW.email))
    AND status NOT IN (
      'converted'::lead_status,
      'upgraded'::lead_status,
      'lost'::lead_status,
      'fake_lead'::lead_status,
      'not_interested'::lead_status,
      'do_not_contact'::lead_status,
      'archived'::lead_status
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_unsubscribe_mark_not_interested ON public.email_unsubscribes;
CREATE TRIGGER trg_unsubscribe_mark_not_interested
AFTER INSERT OR UPDATE ON public.email_unsubscribes
FOR EACH ROW
EXECUTE FUNCTION public.mark_leads_not_interested_on_unsubscribe();