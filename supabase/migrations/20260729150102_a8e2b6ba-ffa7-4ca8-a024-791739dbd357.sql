CREATE OR REPLACE FUNCTION public.stamp_lead_contact_on_quote_sent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  v_at := COALESCE(NEW.last_resent_at, NEW.sent_at, now());
  IF NEW.customer_email IS NULL OR btrim(NEW.customer_email) = '' THEN
    RETURN NEW;
  END IF;

  UPDATE public.sales_leads sl
     SET last_contacted_at = v_at
   WHERE lower(sl.email) = lower(btrim(NEW.customer_email))
     AND (sl.last_contacted_at IS NULL OR sl.last_contacted_at < v_at);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_lead_contact_on_quote_sent ON public.admin_sent_quotes;
CREATE TRIGGER trg_stamp_lead_contact_on_quote_sent
AFTER INSERT OR UPDATE OF sent_at, last_resent_at, resent_count
ON public.admin_sent_quotes
FOR EACH ROW
EXECUTE FUNCTION public.stamp_lead_contact_on_quote_sent();

-- Back-fill existing leads from quotes already sent
UPDATE public.sales_leads sl
   SET last_contacted_at = q.max_at
  FROM (
    SELECT lower(btrim(customer_email)) AS email,
           MAX(COALESCE(last_resent_at, sent_at)) AS max_at
      FROM public.admin_sent_quotes
     WHERE customer_email IS NOT NULL AND btrim(customer_email) <> ''
     GROUP BY 1
  ) q
 WHERE lower(sl.email) = q.email
   AND q.max_at IS NOT NULL
   AND (sl.last_contacted_at IS NULL OR sl.last_contacted_at < q.max_at);