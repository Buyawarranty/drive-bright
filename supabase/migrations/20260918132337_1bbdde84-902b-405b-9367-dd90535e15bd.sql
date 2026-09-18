ALTER TABLE public.sales_leads ADD COLUMN IF NOT EXISTS orr_retry_preferred_agent uuid;

CREATE OR REPLACE FUNCTION public.open_pool_log_outcome(_lead_id uuid, _agent uuid, _outcome text, _reason text DEFAULT NULL::text, _next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _new_status text;_new_queue text;_new_owner uuid;_keep_lock boolean:=false;_tags text[]:=ARRAY[]::text[];_inc_calls integer:=0;_current_calls integer;_attempt_num integer;_lost_tag text;_retry_at timestamptz;_final_action text;_locked_by uuid;_assigned_to uuid;_caller_admin_id uuid;_caller_role text;_is_mgmt boolean:=false;_agent_admin_id uuid;_max_attempts integer:=14;_preferred uuid;_local timestamp;
BEGIN
 SELECT locked_by,assigned_to INTO _locked_by,_assigned_to FROM sales_leads WHERE id=_lead_id; IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found'; END IF;
 SELECT id,role INTO _caller_admin_id,_caller_role FROM admin_users WHERE user_id=auth.uid() AND is_active=true LIMIT 1; _is_mgmt:=_caller_role IN ('admin','super_admin','sales_manager');
 IF NOT(_locked_by=_agent OR _locked_by=_caller_admin_id OR _assigned_to=_agent OR _assigned_to=_caller_admin_id OR (_locked_by IS NULL AND _assigned_to IS NULL) OR _is_mgmt) THEN RAISE EXCEPTION 'Lead is not reserved for this agent'; END IF;
 SELECT id INTO _agent_admin_id FROM admin_users WHERE user_id=_agent AND is_active=true LIMIT 1; IF _agent_admin_id IS NULL THEN _agent_admin_id:=_caller_admin_id; END IF;
 IF _outcome='callback_requested' AND _next_action_at IS NULL THEN RAISE EXCEPTION 'Callback date/time is required'; END IF;
 IF _outcome IN ('not_interested','wrong_number') AND (_reason IS NULL OR btrim(_reason)='') THEN RAISE EXCEPTION 'Reason is required'; END IF;
 SELECT COALESCE(call_count,0) INTO _current_calls FROM sales_leads WHERE id=_lead_id;
 CASE _outcome
 WHEN 'spoke_to_customer' THEN _new_status:='contacted';_new_queue:='owned_by_agent';_new_owner:=_agent_admin_id;_keep_lock:=true;
 WHEN 'no_answer','voicemail_left','line_busy' THEN
   _inc_calls:=1;_attempt_num:=_current_calls+1;_new_owner:=NULL;
   _tags:=CASE _outcome WHEN 'no_answer' THEN ARRAY['no_answer_'||LEAST(_attempt_num,3)::text] WHEN 'voicemail_left' THEN ARRAY['voicemail_left'] ELSE ARRAY['line_busy'] END;
   IF _attempt_num>=_max_attempts THEN SELECT no_answer_final_action INTO _final_action FROM shark_tank_settings WHERE id=1;_final_action:=COALESCE(_final_action,'lost');_new_queue:='nurture_queue';
     IF _final_action='lost' THEN _new_status:='lost';_tags:=_tags||ARRAY['lost_could_not_contact']; ELSE _new_status:='new'; END IF;_retry_at:=NULL;
   ELSE
     _new_status:='new';_new_queue:='retry_queue';
     IF _attempt_num=1 THEN
       -- Day one: the same agent gets a second go 15 minutes later.
       _retry_at:=now()+interval '15 minutes';_preferred:=_agent_admin_id;
     ELSIF _attempt_num=2 THEN
       -- Second miss: the lead is held back until 1pm the same day.
       _local:=(now() AT TIME ZONE 'Europe/London');
       IF _local::time < time '13:00' AND extract(isodow from _local::date) <= 5 THEN
         _retry_at:=((_local::date + time '13:00') AT TIME ZONE 'Europe/London');
       ELSE
         _retry_at:=public.open_pool_next_call_slot();
       END IF;
     ELSE
       -- Thereafter: twice a day (09:30 / 15:30, working days) for 7 days.
       _retry_at:=public.open_pool_next_call_slot();
     END IF;
   END IF;
 WHEN 'callback_requested' THEN _new_status:='callback_booked';_new_queue:='callback_queue';_new_owner:=_agent_admin_id;_keep_lock:=true;
 WHEN 'quote_sent' THEN _new_status:='quote_sent';_new_queue:='owned_by_agent';_new_owner:=_agent_admin_id;_keep_lock:=true;_tags:=ARRAY['quote_sent'];
 WHEN 'policy_sent' THEN _new_status:='policy_sent';_new_queue:='owned_by_agent';_new_owner:=_agent_admin_id;_keep_lock:=true;_tags:=ARRAY['policy_booklet_sent'];
 WHEN 'payment_link_sent' THEN _new_status:='payment_link_sent';_new_queue:='owned_by_agent';_new_owner:=_agent_admin_id;_keep_lock:=true;_tags:=ARRAY['payment_link_sent','high_priority'];
 WHEN 'sold' THEN _new_status:='converted';_new_queue:='closed';_new_owner:=_agent_admin_id;_keep_lock:=true;
 WHEN 'wrong_number' THEN _new_status:='invalid';_new_queue:='closed';_new_owner:=NULL;_tags:=ARRAY['invalid_details'];
 WHEN 'not_interested' THEN _new_status:='lost';_new_queue:='closed';_new_owner:=NULL;_lost_tag:=CASE _reason WHEN 'Price' THEN 'lost_price' WHEN 'Competitor' THEN 'lost_competitor' WHEN 'Trust / claims concern' THEN 'lost_trust_concern' WHEN 'Claim limit concern' THEN 'lost_claim_limit' WHEN 'Already has warranty' THEN 'lost_already_covered' WHEN 'Vehicle not purchased' THEN 'lost_vehicle_not_bought' WHEN 'No perceived need' THEN 'lost_no_longer_interested' ELSE NULL END;IF _lost_tag IS NOT NULL THEN _tags:=ARRAY[_lost_tag];END IF;
 ELSE RAISE EXCEPTION 'Unknown call outcome: %',_outcome; END CASE;
 UPDATE sales_leads SET call_outcome=_outcome,pool_status=_new_status,queue=_new_queue,reason=CASE WHEN _outcome='wrong_number' THEN COALESCE(_reason,'Invalid details') WHEN _reason IS NOT NULL THEN _reason ELSE reason END,
 lost_reason=CASE WHEN _outcome='not_interested' THEN _reason WHEN _outcome IN ('no_answer','voicemail_left','line_busy') AND _attempt_num>=_max_attempts AND _new_status='lost' THEN 'Could not contact after '||_max_attempts||' attempts' ELSE lost_reason END,
 next_action_at=CASE WHEN _outcome='callback_requested' THEN _next_action_at WHEN _outcome IN ('no_answer','voicemail_left','line_busy') THEN _retry_at ELSE NULL END,last_action_at=now(),call_count=COALESCE(call_count,0)+_inc_calls,
 orr_retry_preferred_agent=CASE WHEN _outcome IN ('no_answer','voicemail_left','line_busy') THEN _preferred ELSE NULL END,
 auto_tags=(SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags,ARRAY[]::text[])||_tags))),payment_method=CASE WHEN _outcome='payment_link_sent' THEN 'link_sent' ELSE payment_method END,is_paid=CASE WHEN _outcome='sold' THEN true ELSE is_paid END,payment_date=CASE WHEN _outcome='sold' THEN now() ELSE payment_date END,
 locked_by=CASE WHEN _keep_lock THEN _agent_admin_id ELSE NULL END,locked_at=CASE WHEN _keep_lock THEN COALESCE(locked_at,now()) ELSE NULL END,owner_agent=CASE WHEN _keep_lock THEN _new_owner ELSE NULL END,assigned_to=CASE WHEN _keep_lock THEN _agent_admin_id ELSE NULL END,assigned_at=CASE WHEN _keep_lock THEN COALESCE(assigned_at,now()) ELSE NULL END,orr_first_call_deadline=NULL,orr_offer_expires_at=NULL WHERE id=_lead_id;
END;$function$;

CREATE OR REPLACE FUNCTION public.open_pool_get_next(_agent uuid)
 RETURNS TABLE(lead_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _existing uuid; _picked uuid; _admin_id uuid;
BEGIN
  SELECT id INTO _admin_id FROM public.admin_users WHERE (id=_agent OR user_id=_agent) AND is_active=true LIMIT 1;
  IF _admin_id IS NULL THEN RAISE EXCEPTION 'Active agent not found'; END IF;
  SELECT id INTO _existing FROM public.sales_leads WHERE locked_by=_admin_id AND pool_status='calling_locked' AND owner_agent IS NULL ORDER BY locked_at DESC LIMIT 1;
  IF _existing IS NOT NULL THEN RETURN QUERY SELECT _existing; RETURN; END IF;
  WITH ranked_candidates AS MATERIALIZED (
    SELECT sl.id,sl.email,sl.vehicle_reg,
      CASE WHEN sl.orr_retry_preferred_agent=_admin_id THEN 0
        WHEN 'paid_google'=ANY(sl.auto_tags) THEN 1 WHEN 'paid_facebook'=ANY(sl.auto_tags) THEN 2
        WHEN 'website_quote'=ANY(sl.auto_tags) AND 'high_priority'=ANY(sl.auto_tags) THEN 3
        WHEN sl.queue='callback_queue' AND sl.next_action_at<=now() THEN 4
        WHEN 'warranty_expiring'=ANY(sl.auto_tags) THEN 5 WHEN 'premium_vehicle'=ANY(sl.auto_tags) THEN 6
        WHEN 'website_quote'=ANY(sl.auto_tags) THEN 7 WHEN COALESCE(sl.call_count,0)=0 THEN 8 WHEN sl.queue='nurture_queue' THEN 9 ELSE 10 END priority_band,
      sl.next_action_at,sl.created_at
    FROM public.sales_leads sl
    WHERE sl.queue IN ('live_open_pool','morning_call_queue','retry_queue','callback_queue','nurture_queue')
      AND (sl.pool_status IS NULL OR sl.pool_status IN ('new','callback_booked','contacted')) AND COALESCE(sl.is_paid,false)=false
      AND sl.status NOT IN ('converted'::lead_status,'fake_lead'::lead_status,'lost'::lead_status)
      AND sl.owner_agent IS NULL AND sl.assigned_to IS NULL AND (sl.locked_by IS NULL OR sl.locked_at<now()-interval '7 minutes')
      AND (sl.next_action_at IS NULL OR sl.next_action_at<=now())
      AND (sl.queue<>'live_open_pool' OR (COALESCE(sl.call_count,0)=0 AND sl.status='new'::lead_status))
      -- Customer browsing window: a brand new lead is held back for 2 minutes so
      -- the customer can finish the pricing/checkout journey before being rung.
      AND (COALESCE(sl.call_count,0)>0 OR sl.created_at <= now() - interval '2 minutes')
      -- Day-one second attempt is kept for the agent who made the first call for
      -- 10 minutes; after that any eligible agent can pick it up.
      AND (sl.orr_retry_preferred_agent IS NULL OR sl.orr_retry_preferred_agent=_admin_id OR sl.next_action_at <= now() - interval '10 minutes')
      AND (sl.eligible_at IS NULL OR sl.eligible_at<=now()) AND (sl.orr_pool_next_open_at IS NULL OR sl.orr_pool_next_open_at<=now())
    ORDER BY priority_band,sl.next_action_at NULLS LAST,sl.created_at DESC LIMIT 500
  ), eligible AS MATERIALIZED (
    SELECT rc.id,rc.priority_band,rc.next_action_at,rc.created_at FROM ranked_candidates rc
    WHERE NOT EXISTS (SELECT 1 FROM public.customers c WHERE COALESCE(c.is_deleted,false)=false AND lower(COALESCE(c.status,'')) NOT IN ('cancelled','refunded')
      AND ((COALESCE(rc.email,'')<>'' AND lower(c.email)=lower(rc.email)) OR (COALESCE(rc.vehicle_reg,'')<>'' AND upper(regexp_replace(c.registration_plate,'\s+','','g'))=upper(regexp_replace(rc.vehicle_reg,'\s+','','g')))))
  ) SELECT id INTO _picked FROM eligible ORDER BY priority_band,next_action_at NULLS LAST,created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF _picked IS NULL THEN RETURN; END IF;
  UPDATE public.sales_leads SET assigned_to=NULL,owner_agent=NULL,pool_status='calling_locked',locked_by=_admin_id,locked_at=now(),last_action_at=now(),orr_retry_preferred_agent=NULL,orr_first_call_deadline=now()+interval '120 seconds',updated_at=now() WHERE id=_picked;
  RETURN QUERY SELECT _picked;
END;
$function$;