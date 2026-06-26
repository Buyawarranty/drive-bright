
CREATE OR REPLACE FUNCTION public.log_claim_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.claim_communications (
      claim_id, direction, communication_type, subject, message, sender_email, recipient_email, metadata
    ) VALUES (
      NEW.id,
      'internal',
      'status_change',
      'Status changed',
      COALESCE(OLD.status, 'new') || ' → ' || COALESCE(NEW.status, 'new'),
      NULL,
      NEW.email,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_claim_status_change ON public.claims_submissions;
CREATE TRIGGER trg_log_claim_status_change
AFTER UPDATE ON public.claims_submissions
FOR EACH ROW EXECUTE FUNCTION public.log_claim_status_change();
