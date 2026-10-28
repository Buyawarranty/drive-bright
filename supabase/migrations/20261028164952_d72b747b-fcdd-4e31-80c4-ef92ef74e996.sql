CREATE OR REPLACE FUNCTION public.open_pool_next_call_slot()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- ORR chase cadence: reopen one hour after the last miss, any day, any time; no attempt limit.
  SELECT now() + interval '1 hour';
$function$;

CREATE OR REPLACE FUNCTION public.open_pool_log_outcome(_lead_id uuid, _agent uuid, _outcome text, _reason text DEFAULT NULL::text, _next_action_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _new_status text;_new_queue text;_new_owner uuid;_keep_lock boolean:=false;_tags text[]:=ARRAY[]::text[];_inc_calls integer:=0;_current_calls integer;_attempt_num integer;_lost_tag text;_retry_at timestamptz;_locked_by uuid;_assigned_to uuid;_caller_admin_id uuid;_caller_role text;_is_mgmt boolean:=false;_agent_admin_id uuid;_preferred uuid;
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
   _new_status:='new';_new_queue:='retry_queue';
   IF _attempt_num=1 THEN
     -- First miss: the same agent gets a second go 15 minutes later.
     _retry_at:=now()+interval '15 minutes';_preferred:=_agent_admin_id;
   ELSE
     -- Thereafter: reopened every hour, any day and time, with no attempt limit, until the lead is closed.
     _retry_at:=public.open_pool_next_call_slot();
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
 lost_reason=CASE WHEN _outcome='not_interested' THEN _reason ELSE lost_reason END,
 next_action_at=CASE WHEN _outcome='callback_requested' THEN _next_action_at WHEN _outcome IN ('no_answer','voicemail_left','line_busy') THEN _retry_at ELSE NULL END,last_action_at=now(),call_count=COALESCE(call_count,0)+_inc_calls,
 orr_retry_preferred_agent=CASE WHEN _outcome IN ('no_answer','voicemail_left','line_busy') THEN _preferred ELSE NULL END,
 auto_tags=(SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(auto_tags,ARRAY[]::text[])||_tags))),payment_method=CASE WHEN _outcome='payment_link_sent' THEN 'link_sent' ELSE payment_method END,is_paid=CASE WHEN _outcome='sold' THEN true ELSE is_paid END,payment_date=CASE WHEN _outcome='sold' THEN now() ELSE payment_date END,
 locked_by=CASE WHEN _keep_lock THEN _agent_admin_id ELSE NULL END,locked_at=CASE WHEN _keep_lock THEN COALESCE(locked_at,now()) ELSE NULL END,owner_agent=CASE WHEN _keep_lock THEN _new_owner ELSE NULL END,assigned_to=CASE WHEN _keep_lock THEN _agent_admin_id ELSE NULL END,assigned_at=CASE WHEN _keep_lock THEN COALESCE(assigned_at,now()) ELSE NULL END,orr_first_call_deadline=NULL,orr_offer_expires_at=NULL WHERE id=_lead_id;
END;$function$;