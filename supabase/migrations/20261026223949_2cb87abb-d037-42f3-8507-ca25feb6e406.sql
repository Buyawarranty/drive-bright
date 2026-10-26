CREATE OR REPLACE FUNCTION public.staff_access_log_attempt(p_user_id uuid,p_email text,p_hash text,p_outcome text,p_ip text,p_label text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_device uuid; v_online boolean; v_city text; v_country text; BEGIN
IF p_outcome NOT IN ('invalid_credentials','inactive_account','signin_allowed','device_blocked') THEN RAISE EXCEPTION 'Invalid outcome'; END IF;
SELECT id INTO v_device FROM public.staff_approved_devices WHERE user_id=p_user_id AND credential_hash=p_hash;
SELECT EXISTS(SELECT 1 FROM public.crm_attendance_sessions s JOIN public.admin_users a ON a.id=s.admin_user_id WHERE a.user_id=p_user_id AND s.ended_at IS NULL AND s.last_seen_at>now()-interval '90 seconds') INTO v_online;
SELECT city,country INTO v_city,v_country FROM public.staff_work_locations WHERE ip_address=p_ip ORDER BY last_seen_at DESC LIMIT 1;
INSERT INTO public.staff_access_attempts(user_id,attempted_email,device_id,outcome,ip_address,city,country,device_label,account_online) VALUES(p_user_id,lower(p_email),v_device,p_outcome,p_ip,v_city,v_country,p_label,v_online);
UPDATE public.staff_approved_devices SET last_seen_at=now() WHERE id=v_device;
END $$;
REVOKE ALL ON FUNCTION public.staff_access_log_attempt(uuid,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_access_log_attempt(uuid,text,text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public.staff_device_report(p_caller uuid,p_from date,p_to date,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result jsonb; BEGIN
IF NOT public.is_active_admin_user(p_caller) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_caller AND role::text IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Invalid range'; END IF;
SELECT jsonb_build_object('enabled',(SELECT enabled FROM public.staff_device_settings WHERE id=true),
'devices',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'email',a.email,'device_label',d.device_label,'status',d.status,'requested_at',d.requested_at,'approved_at',d.approved_at,'last_seen_at',d.last_seen_at) ORDER BY d.requested_at DESC) FROM public.staff_approved_devices d JOIN public.admin_users a ON a.user_id=d.user_id),'[]'::jsonb),
'attempts',COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC,q.id DESC) FROM (SELECT id,attempted_email,outcome,ip_address,city,country,device_label,account_online,acknowledged_at,created_at FROM public.staff_access_attempts WHERE created_at>=p_from::timestamp AT TIME ZONE 'Europe/London' AND created_at<(p_to+1)::timestamp AT TIME ZONE 'Europe/London' ORDER BY created_at DESC,id DESC LIMIT 201 OFFSET p_offset) q),'[]'::jsonb),
'alerts',COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,attempted_email,outcome,ip_address,city,country,device_label,account_online,created_at FROM public.staff_access_attempts WHERE acknowledged_at IS NULL AND outcome<>'signin_allowed' ORDER BY created_at DESC LIMIT 50) q),'[]'::jsonb)) INTO result;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.staff_device_report(uuid,date,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_device_report(uuid,date,date,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_staff_approved_device() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE v_enabled boolean; v_device text; BEGIN
IF auth.uid() IS NULL OR current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role' THEN RETURN; END IF;
SELECT enabled INTO v_enabled FROM public.staff_device_settings WHERE id=true;
IF NOT COALESCE(v_enabled,true) OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=auth.uid()) THEN RETURN; END IF;
v_device:=current_setting('request.headers',true)::jsonb->>'x-staff-device';
IF v_device IS NULL OR v_device !~ '^[a-f0-9]{64}$' OR NOT EXISTS(SELECT 1 FROM public.staff_approved_devices WHERE user_id=auth.uid() AND credential_hash=encode(extensions.digest(v_device,'sha256'),'hex') AND status='approved' AND revoked_at IS NULL) THEN RAISE EXCEPTION 'STAFF_DEVICE_APPROVAL_REQUIRED' USING ERRCODE='42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.enforce_staff_approved_device() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_staff_approved_device() TO service_role;
