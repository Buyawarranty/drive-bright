CREATE TABLE public.staff_password_renewals (user_id uuid PRIMARY KEY, changed_at timestamptz NOT NULL DEFAULT now(), forced_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.staff_password_renewals TO service_role;
ALTER TABLE public.staff_password_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only staff password renewal" ON public.staff_password_renewals FOR ALL TO service_role USING (true) WITH CHECK (true);
INSERT INTO public.staff_password_renewals(user_id) SELECT DISTINCT user_id FROM public.admin_users WHERE user_id IS NOT NULL ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION public.staff_password_status(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.staff_password_renewals; active_staff boolean; due timestamptz;
BEGIN
SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_user_id AND is_active=true AND archived_at IS NULL AND (access_expires_at IS NULL OR access_expires_at>now())) INTO active_staff;
IF NOT active_staff THEN RETURN jsonb_build_object('is_staff',false); END IF;
SELECT * INTO s FROM public.staff_password_renewals WHERE user_id=p_user_id;
IF NOT FOUND THEN INSERT INTO public.staff_password_renewals(user_id) VALUES(p_user_id) RETURNING * INTO s; END IF;
due := s.changed_at + interval '3 months';
RETURN jsonb_build_object('is_staff',true,'changed_at',s.changed_at,'due_at',due,'must_change',s.forced_at IS NOT NULL OR due<=now());
END; $$;
REVOKE ALL ON FUNCTION public.staff_password_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_password_status(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.staff_password_record_change(p_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_user_id) THEN RETURN; END IF;
INSERT INTO public.staff_password_renewals(user_id,changed_at,updated_at) VALUES(p_user_id,now(),now()) ON CONFLICT(user_id) DO UPDATE SET changed_at=now(),forced_at=NULL,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.staff_password_record_change(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.staff_password_record_change(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.enforce_staff_password_renewal() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL OR current_setting('request.jwt.claims',true)::jsonb->>'role' = 'service_role' THEN RETURN; END IF;
IF EXISTS(SELECT 1 FROM public.admin_users a JOIN public.staff_password_renewals s ON s.user_id=a.user_id WHERE a.user_id=auth.uid() AND a.is_active=true AND a.archived_at IS NULL AND (s.forced_at IS NOT NULL OR s.changed_at+interval '3 months'<=now())) THEN RAISE EXCEPTION 'STAFF_PASSWORD_RENEWAL_REQUIRED: Please change your personal password to continue' USING ERRCODE='42501'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_staff_password_renewal() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_staff_password_renewal() TO anon,authenticated,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request='public.enforce_staff_password_renewal';
NOTIFY pgrst,'reload config';
CREATE OR REPLACE FUNCTION public.login_gateway_manage(p_user_id uuid,p_password text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s public.login_gateway_settings;
BEGIN
IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_user_id AND is_active=true AND archived_at IS NULL AND role IN ('admin','super_admin') AND (access_expires_at IS NULL OR access_expires_at>now())) THEN RAISE EXCEPTION 'Admin or super admin required' USING ERRCODE='42501'; END IF;
IF p_password IS NOT NULL THEN
IF length(p_password)<12 OR length(p_password)>128 THEN RAISE EXCEPTION 'Use a password between 12 and 128 characters'; END IF;
SELECT * INTO s FROM public.login_gateway_settings WHERE id=true FOR UPDATE;
IF extensions.crypt(p_password,s.password_hash)=s.password_hash THEN RAISE EXCEPTION 'Choose a different gateway password'; END IF;
UPDATE public.login_gateway_settings SET password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',12)),version=version+1,updated_at=now(),updated_by=p_user_id WHERE id=true;
END IF;
SELECT * INTO s FROM public.login_gateway_settings WHERE id=true;
RETURN jsonb_build_object('can_manage',true,'updated_at',s.updated_at,'due_at',s.updated_at+interval '3 months','renewal_due',s.updated_at+interval '3 months'<=now());
END; $$;
REVOKE ALL ON FUNCTION public.login_gateway_manage(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.login_gateway_manage(uuid,text) TO service_role;