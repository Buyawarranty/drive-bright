CREATE TABLE public.crm_attendance_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, admin_user_id uuid NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now(),
 first_activity_at timestamptz, last_activity_at timestamptz, ended_at timestamptz,
 end_reason text, current_tab text, visible boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.crm_attendance_sessions TO authenticated;
GRANT ALL ON public.crm_attendance_sessions TO service_role;
ALTER TABLE public.crm_attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Management attendance sessions" ON public.crm_attendance_sessions FOR SELECT TO authenticated USING (public.is_active_admin_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role::text IN ('admin','super_admin','sales_manager')));
CREATE INDEX crm_attendance_sessions_staff_seen ON public.crm_attendance_sessions(admin_user_id,last_seen_at);
CREATE TRIGGER crm_attendance_sessions_updated BEFORE UPDATE ON public.crm_attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.crm_attendance_days (
 user_id uuid NOT NULL, admin_user_id uuid NOT NULL, day date NOT NULL,
 active_seconds integer NOT NULL DEFAULT 0, first_activity_at timestamptz, last_activity_at timestamptz,
 last_tick_at timestamptz, last_activity_clock timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,day)
);
GRANT SELECT ON public.crm_attendance_days TO authenticated;
GRANT ALL ON public.crm_attendance_days TO service_role;
ALTER TABLE public.crm_attendance_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Management attendance days" ON public.crm_attendance_days FOR SELECT TO authenticated USING (public.is_active_admin_user(auth.uid()) AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=auth.uid() AND r.role::text IN ('admin','super_admin','sales_manager')));
CREATE INDEX crm_attendance_days_day ON public.crm_attendance_days(day,admin_user_id);
CREATE TRIGGER crm_attendance_days_updated BEFORE UPDATE ON public.crm_attendance_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.record_crm_attendance(p_session_id uuid,p_kind text,p_current_tab text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 v_uid uuid := auth.uid(); v_staff uuid; v_now timestamptz := clock_timestamp();
 v_session public.crm_attendance_sessions%ROWTYPE; v_last_tick timestamptz; v_last_activity timestamptz;
 v_from timestamptz; v_to timestamptz; v_day date; v_seconds integer;
BEGIN
 SELECT id INTO v_staff FROM public.admin_users WHERE user_id=v_uid AND is_active=true LIMIT 1;
 IF v_staff IS NULL THEN RAISE EXCEPTION 'Active staff access required' USING ERRCODE='42501'; END IF;
 IF p_kind NOT IN ('open','activity','ping','hidden','left_crm','logout') THEN RAISE EXCEPTION 'Invalid attendance event'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_uid::text,117));
 SELECT * INTO v_session FROM public.crm_attendance_sessions WHERE id=p_session_id FOR UPDATE;
 IF FOUND AND v_session.user_id<>v_uid THEN RAISE EXCEPTION 'Session owner mismatch' USING ERRCODE='42501'; END IF;
 IF v_session.id IS NULL THEN
   IF p_kind NOT IN ('open','activity','ping') THEN RETURN; END IF;
   INSERT INTO public.crm_attendance_sessions(id,user_id,admin_user_id,current_tab) VALUES(p_session_id,v_uid,v_staff,left(p_current_tab,80)) RETURNING * INTO v_session;
 END IF;
 IF v_session.ended_at IS NOT NULL THEN RETURN; END IF;
 SELECT max(last_tick_at),max(last_activity_clock) INTO v_last_tick,v_last_activity FROM public.crm_attendance_days WHERE user_id=v_uid AND day >= (v_now AT TIME ZONE 'Europe/London')::date-1;
 -- Only a recent, visible session with meaningful interaction can earn time.
 -- A per-user clock serializes all tabs and caps each interval at 30 seconds.
 IF v_session.visible AND v_now-v_session.last_seen_at<=interval '90 seconds' AND v_last_tick IS NOT NULL AND v_last_activity IS NOT NULL THEN
   v_from:=greatest(v_last_tick,v_now-interval '30 seconds',v_session.started_at);
   v_to:=least(v_now,v_last_activity+interval '60 seconds');
   IF v_to>v_from THEN
     FOR v_day IN SELECT generate_series((v_from AT TIME ZONE 'Europe/London')::date,(v_to AT TIME ZONE 'Europe/London')::date,interval '1 day')::date LOOP
       v_seconds:=greatest(0,floor(extract(epoch FROM least(v_to,(v_day+1)::timestamp AT TIME ZONE 'Europe/London')-greatest(v_from,v_day::timestamp AT TIME ZONE 'Europe/London')))::integer);
       INSERT INTO public.crm_attendance_days(user_id,admin_user_id,day,active_seconds) VALUES(v_uid,v_staff,v_day,v_seconds)
       ON CONFLICT(user_id,day) DO UPDATE SET active_seconds=crm_attendance_days.active_seconds+EXCLUDED.active_seconds;
     END LOOP;
   END IF;
 END IF;
 INSERT INTO public.crm_attendance_days(user_id,admin_user_id,day,last_tick_at,last_activity_clock,first_activity_at,last_activity_at)
 VALUES(v_uid,v_staff,(v_now AT TIME ZONE 'Europe/London')::date,v_now,CASE WHEN p_kind='activity' THEN v_now ELSE v_last_activity END,CASE WHEN p_kind='activity' THEN v_now END,CASE WHEN p_kind='activity' THEN v_now END)
 ON CONFLICT(user_id,day) DO UPDATE SET last_tick_at=v_now,
 last_activity_clock=CASE WHEN p_kind='activity' THEN v_now ELSE crm_attendance_days.last_activity_clock END,
 first_activity_at=COALESCE(crm_attendance_days.first_activity_at,EXCLUDED.first_activity_at),
 last_activity_at=COALESCE(EXCLUDED.last_activity_at,crm_attendance_days.last_activity_at);
 UPDATE public.crm_attendance_sessions SET last_seen_at=v_now,
 first_activity_at=CASE WHEN p_kind='activity' THEN COALESCE(first_activity_at,v_now) ELSE first_activity_at END,
 last_activity_at=CASE WHEN p_kind='activity' THEN v_now ELSE last_activity_at END,
 visible=p_kind NOT IN ('hidden','left_crm','logout'), current_tab=left(p_current_tab,80),
 ended_at=CASE WHEN p_kind IN ('left_crm','logout') THEN v_now ELSE NULL END,
 end_reason=CASE WHEN p_kind IN ('left_crm','logout') THEN p_kind ELSE NULL END WHERE id=p_session_id;
END; $$;
REVOKE ALL ON FUNCTION public.record_crm_attendance(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_crm_attendance(uuid,text,text) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_crm_attendance(p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.is_active_admin_user(auth.uid()) OR NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','super_admin','sales_manager')) THEN RAISE EXCEPTION 'Management access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Choose a range of up to one year'; END IF;
 SELECT jsonb_build_object(
 'staff',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'first_name',first_name,'last_name',last_name,'role',role)) FROM public.admin_users WHERE is_active=true),'[]'::jsonb),
 'days',COALESCE((SELECT jsonb_agg(jsonb_build_object('admin_user_id',admin_user_id,'day',day,'active_seconds',active_seconds,'first_activity_at',first_activity_at,'last_activity_at',last_activity_at)) FROM public.crm_attendance_days WHERE day BETWEEN p_from AND p_to),'[]'::jsonb),
 'sessions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'admin_user_id',admin_user_id,'started_at',started_at,'last_seen_at',last_seen_at,'first_activity_at',first_activity_at,'last_activity_at',last_activity_at,'ended_at',ended_at,'end_reason',end_reason,'current_tab',current_tab,'visible',visible) ORDER BY started_at DESC) FROM public.crm_attendance_sessions WHERE started_at < (p_to+1)::timestamp AT TIME ZONE 'Europe/London' AND COALESCE(ended_at,last_seen_at)>=p_from::timestamp AT TIME ZONE 'Europe/London'),'[]'::jsonb),
 'measured_at',now()) INTO v_result;
 RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.get_crm_attendance(date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_crm_attendance(date,date) TO authenticated,service_role;