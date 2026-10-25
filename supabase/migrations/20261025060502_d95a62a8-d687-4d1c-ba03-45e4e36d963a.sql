ALTER FUNCTION public.record_crm_attendance(uuid,text,text) RENAME TO record_crm_attendance_internal;
ALTER FUNCTION public.get_crm_attendance(date,date) RENAME TO get_crm_attendance_internal;
REVOKE ALL ON FUNCTION public.record_crm_attendance_internal(uuid,text,text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_crm_attendance_internal(date,date) FROM authenticated;
CREATE FUNCTION public.record_crm_attendance(p_user_id uuid,p_session_id uuid,p_kind text,p_current_tab text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
 PERFORM public.record_crm_attendance_internal(p_session_id,p_kind,p_current_tab);
END; $$;
REVOKE ALL ON FUNCTION public.record_crm_attendance(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_crm_attendance(uuid,uuid,text,text) TO service_role;
CREATE FUNCTION public.get_crm_attendance(p_user_id uuid,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
 RETURN public.get_crm_attendance_internal(p_from,p_to);
END; $$;
REVOKE ALL ON FUNCTION public.get_crm_attendance(uuid,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_crm_attendance(uuid,date,date) TO service_role;