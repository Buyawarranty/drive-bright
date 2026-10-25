DO $$ DECLARE v_definition text; BEGIN
 SELECT pg_get_functiondef('public.record_crm_attendance_internal(uuid,text,text)'::regprocedure) INTO v_definition;
 v_definition := replace(v_definition,'IF v_session.visible AND v_now-v_session.last_seen_at<=interval ''90 seconds'' AND v_last_tick IS NOT NULL AND v_last_activity IS NOT NULL THEN','IF v_session.visible AND v_session.last_activity_at IS NOT NULL AND v_now-v_session.last_seen_at<=interval ''90 seconds'' AND v_last_tick IS NOT NULL AND v_last_activity IS NOT NULL THEN');
 v_definition := replace(v_definition,'v_to:=least(v_now,v_last_activity+interval ''60 seconds'');','v_to:=least(v_now,v_last_activity+interval ''60 seconds'',v_session.last_activity_at+interval ''60 seconds'');');
 EXECUTE v_definition;
END; $$;