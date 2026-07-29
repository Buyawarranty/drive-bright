CREATE OR REPLACE FUNCTION public.sales_leads_link_customer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_norm text;
  v_lc public.lead_customers%ROWTYPE;
BEGIN
  v_norm := public.normalize_phone_uk(NEW.phone);
  NEW.phone_normalized := v_norm;
  IF v_norm IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_lc FROM public.lead_customers WHERE phone_normalized = v_norm LIMIT 1;
  IF NOT FOUND THEN
    INSERT INTO public.lead_customers (phone_normalized, phone_original)
    VALUES (v_norm, NEW.phone)
    RETURNING * INTO v_lc;
  END IF;

  NEW.customer_contact_id := v_lc.id;

  IF TG_OP = 'INSERT' THEN
    NEW.orr_attempt_count   := GREATEST(COALESCE(NEW.orr_attempt_count, 0), COALESCE(v_lc.attempt_count, 0));
    NEW.orr_next_release_at := COALESCE(NEW.orr_next_release_at, v_lc.next_eligible_at);
    NEW.orr_last_attempt_at := COALESCE(NEW.orr_last_attempt_at, v_lc.last_attempt_at);
    IF v_lc.do_not_call THEN
      NEW.do_not_contact := true;
      NEW.do_not_contact_reason := COALESCE(NEW.do_not_contact_reason, v_lc.do_not_call_reason);
      NEW.do_not_contact_at     := COALESCE(NEW.do_not_contact_at, v_lc.do_not_call_at);
    END IF;
    IF v_lc.dormant AND NEW.orr_dormant_at IS NULL THEN
      NEW.orr_dormant_at := v_lc.dormant_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Staff read policy was comparing the wrong column; fix so staff can read contact records
DROP POLICY IF EXISTS "Staff can read lead_customers" ON public.lead_customers;
CREATE POLICY "Staff can read lead_customers" ON public.lead_customers
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active = true));