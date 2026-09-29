ALTER TABLE public.customer_policies
ADD COLUMN renewal_review_required boolean NOT NULL DEFAULT false;

UPDATE public.customer_policies cp
SET renewal_review_required = true
WHERE EXISTS (
  SELECT 1 FROM public.renewal_reviews rr
  WHERE rr.policy_id = cp.id AND rr.status IN ('pending','do_not_renew')
);

CREATE OR REPLACE FUNCTION public.sync_policy_renewal_review_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customer_policies
  SET renewal_review_required = NEW.status IN ('pending','do_not_renew'), updated_at = now()
  WHERE id = NEW.policy_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_policy_renewal_review_hold_after_write
AFTER INSERT OR UPDATE OF status ON public.renewal_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_policy_renewal_review_hold();

CREATE OR REPLACE FUNCTION public.create_renewal_lead_for_policy(p_policy_id uuid, p_force boolean DEFAULT false, p_actor uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p RECORD; v_c RECORD; v_year integer; v_existing uuid; v_open_lead uuid; v_owner uuid;
  v_reason text := 'renewals_round_robin'; v_lead_id uuid; v_phone_tail text; v_email text;
  v_days integer; v_reasons text[]; v_claim_count integer := 0; v_can_override boolean := false;
BEGIN
  SELECT * INTO v_p FROM public.customer_policies WHERE id = p_policy_id;
  IF v_p.id IS NULL OR v_p.customer_id IS NULL THEN RETURN NULL; END IF;
  v_year := EXTRACT(YEAR FROM v_p.policy_end_date)::int;
  SELECT * INTO v_c FROM public.customers WHERE id = v_p.customer_id;
  v_email := NULLIF(lower(btrim(COALESCE(v_c.email, v_p.email, ''))), '');
  v_phone_tail := NULLIF(RIGHT(COALESCE(public.normalize_uk_phone(v_c.phone), ''), 9), '');
  IF v_email IS NULL AND v_phone_tail IS NULL THEN RETURN NULL; END IF;

  v_reasons := public.renewal_eligibility_reasons(p_policy_id);
  SELECT count(*)::integer INTO v_claim_count FROM public.claims_submissions cs
  WHERE cs.policy_id = p_policy_id
     OR (v_email IS NOT NULL AND lower(btrim(COALESCE(cs.email, ''))) = v_email)
     OR (NULLIF(regexp_replace(upper(COALESCE(v_c.registration_plate, '')), '[^A-Z0-9]', '', 'g'), '') IS NOT NULL
       AND regexp_replace(upper(COALESCE(cs.vehicle_registration, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_c.registration_plate), '[^A-Z0-9]', '', 'g'));

  v_can_override := p_force AND public.is_management((SELECT auth.uid()))
    AND cardinality(v_reasons) = 1 AND v_reasons[1] = 'claim_made';

  IF cardinality(v_reasons) > 0 AND NOT v_can_override THEN
    INSERT INTO public.renewal_reviews (policy_id, customer_id, renewal_year, reasons, claim_count, status)
    VALUES (p_policy_id, v_p.customer_id, v_year, v_reasons, v_claim_count,
      CASE WHEN v_reasons = ARRAY['claim_made']::text[] THEN 'pending' ELSE 'do_not_renew' END)
    ON CONFLICT (policy_id, renewal_year) DO UPDATE SET
      reasons=EXCLUDED.reasons, claim_count=EXCLUDED.claim_count,
      status=CASE WHEN public.renewal_reviews.status='approved' THEN 'approved' ELSE EXCLUDED.status END,
      updated_at=now();
    RETURN NULL;
  END IF;

  SELECT lead_id INTO v_existing FROM public.renewal_lead_links WHERE policy_id=p_policy_id AND renewal_year=v_year;
  IF FOUND THEN RETURN v_existing; END IF;
  v_days := v_p.policy_end_date::date - CURRENT_DATE;

  SELECT sl.id INTO v_open_lead FROM public.sales_leads sl
  WHERE sl.status NOT IN ('lost','converted','fake_lead','do_not_contact','archived')
    AND ((v_email IS NOT NULL AND lower(btrim(COALESCE(sl.email,'')))=v_email)
      OR (v_phone_tail IS NOT NULL AND RIGHT(COALESCE(public.normalize_uk_phone(sl.phone),''),9)=v_phone_tail))
  ORDER BY sl.updated_at DESC LIMIT 1;

  IF v_open_lead IS NOT NULL THEN
    UPDATE public.sales_leads SET notes=COALESCE(notes||E'\n','')||'RENEWAL DUE — policy '||COALESCE(v_p.policy_number,'')||' expires '||to_char(v_p.policy_end_date,'DD Mon YYYY')||CASE WHEN v_days>=0 THEN ' ('||v_days||' days).' ELSE ' ('||abs(v_days)||' days overdue).' END,last_resubmitted_at=now(),updated_at=now() WHERE id=v_open_lead;
    INSERT INTO public.renewal_lead_links(policy_id,renewal_year,lead_id,customer_id,assigned_to,assignment_reason,attached_to_existing,created_by)
    VALUES(p_policy_id,v_year,v_open_lead,v_p.customer_id,(SELECT assigned_to FROM public.sales_leads WHERE id=v_open_lead),CASE WHEN v_can_override THEN 'manager_approved_claim' ELSE 'attached_to_open_lead' END,true,COALESCE(p_actor,public.current_admin_user_id()));
    RETURN v_open_lead;
  END IF;

  v_owner:=public.resolve_sale_credit(v_c.sale_credit_admin_user_id,v_p.payment_confirmed_by,v_p.quote_sent_by,v_c.assigned_to);
  IF v_owner IS NOT NULL AND public.agent_works_renewals(v_owner) THEN v_reason:=CASE WHEN v_can_override THEN 'manager_approved_claim' ELSE 'original_seller' END; ELSE v_owner:=NULL; END IF;
  IF v_owner IS NULL THEN
    SELECT au.id INTO v_owner FROM public.admin_users au JOIN public.lead_team_members ltm ON ltm.admin_user_id=au.id LEFT JOIN public.agent_distribution_caps adc ON adc.admin_user_id=au.id
    WHERE ltm.workstream_renewals=true AND au.is_active=true AND au.archived_at IS NULL AND au.role IN ('sales','sales_lead') AND COALESCE(adc.paused,false)=false AND NOT public.agent_on_leave(au.id)
    ORDER BY adc.last_assigned_at ASC NULLS FIRST,adc.sort_order ASC NULLS LAST,au.created_at ASC LIMIT 1 FOR UPDATE OF adc SKIP LOCKED;
    IF v_can_override THEN v_reason:='manager_approved_claim'; END IF;
  END IF;

  INSERT INTO public.sales_leads(first_name,last_name,email,phone,vehicle_reg,vehicle_make,vehicle_model,vehicle_year,mileage,status,priority,lead_source,original_source,notes,auto_tags,assigned_to,assigned_at,manual_entry,last_resubmitted_at)
  VALUES(COALESCE(v_c.first_name,split_part(COALESCE(v_c.name,''),' ',1)),COALESCE(v_c.last_name,NULLIF(regexp_replace(COALESCE(v_c.name,''),'^\S+\s*',''),'')),COALESCE(v_c.email,''),v_c.phone,v_c.registration_plate,v_c.vehicle_make,v_c.vehicle_model,v_c.vehicle_year,v_c.mileage,'new','high','other','renewal',CASE WHEN v_can_override THEN 'MANAGER APPROVED CLAIM-HISTORY RENEWAL — ' ELSE 'RENEWAL — ' END||'policy '||COALESCE(v_p.policy_number,'')||' ('||COALESCE(v_p.plan_type,'')||') '||CASE WHEN v_days>=0 THEN 'expires '||to_char(v_p.policy_end_date,'DD Mon YYYY')||', '||v_days||' days away.' ELSE 'expired '||to_char(v_p.policy_end_date,'DD Mon YYYY')||', '||abs(v_days)||' days overdue.' END,CASE WHEN v_can_override THEN ARRAY['Renewal','Manager approved claim history']::text[] ELSE ARRAY['Renewal']::text[] END,v_owner,CASE WHEN v_owner IS NOT NULL THEN now() ELSE NULL END,v_owner IS NOT NULL,now()) RETURNING id INTO v_lead_id;
  IF v_owner IS NOT NULL AND v_reason='renewals_round_robin' THEN UPDATE public.agent_distribution_caps SET last_assigned_at=now(),updated_at=now() WHERE admin_user_id=v_owner; END IF;
  INSERT INTO public.renewal_lead_links(policy_id,renewal_year,lead_id,customer_id,assigned_to,assignment_reason,created_by) VALUES(p_policy_id,v_year,v_lead_id,v_p.customer_id,v_owner,v_reason,COALESCE(p_actor,public.current_admin_user_id()));
  RETURN v_lead_id;
END;
$$;