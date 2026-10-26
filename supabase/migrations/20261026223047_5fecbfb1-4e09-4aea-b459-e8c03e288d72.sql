DO $$ DECLARE v_definition text; BEGIN SELECT pg_get_functiondef(oid) INTO v_definition FROM pg_proc WHERE proname='get_crm_attendance_internal'; IF v_definition IS NULL OR position('FROM public.admin_users WHERE is_active=true' in v_definition)=0 THEN RAISE EXCEPTION 'Attendance definition differs; review required'; END IF; EXECUTE replace(v_definition,'FROM public.admin_users WHERE is_active=true','FROM public.admin_users'); END $$;
CREATE OR REPLACE FUNCTION public.get_staff_signin_audit(p_user_id uuid, p_from date, p_to date, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.is_active_admin_user(p_user_id) OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=p_user_id AND role::text IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Administrator access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Invalid audit range'; END IF;
 SELECT jsonb_build_object('events',COALESCE(jsonb_agg(row_data ORDER BY event_at DESC,event_id DESC),'[]'::jsonb),'has_more',count(*)=201) INTO v_result FROM (
 SELECT a.created_at event_at,a.id event_id,jsonb_build_object('id',a.id,'created_at',a.created_at,'event',a.payload->>'action','ip_address',NULLIF(a.ip_address,''),'admin_user_id',s.id,'email',s.email,'name',trim(concat_ws(' ',s.first_name,s.last_name)),'is_active',s.is_active) row_data
 FROM auth.audit_log_entries a JOIN public.admin_users s ON s.user_id::text=a.payload->>'actor_id'
 WHERE a.created_at>=p_from::timestamp AT TIME ZONE 'Europe/London' AND a.created_at<(p_to+1)::timestamp AT TIME ZONE 'Europe/London'
 AND a.payload->>'action' IN ('login','logout','user_updated_password','user_recovery_requested')
 ORDER BY a.created_at DESC,a.id DESC LIMIT 201 OFFSET p_offset
 ) q;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.get_staff_signin_audit(uuid,date,date,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_signin_audit(uuid,date,date,integer) TO service_role;