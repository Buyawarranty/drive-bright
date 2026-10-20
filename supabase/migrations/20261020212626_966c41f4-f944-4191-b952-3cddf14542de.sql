CREATE TABLE public.login_gateway_settings (id boolean PRIMARY KEY DEFAULT true, password_hash text NOT NULL, version bigint NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT ALL ON public.login_gateway_settings TO service_role;
ALTER TABLE public.login_gateway_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.login_gateway_settings(id,password_hash) VALUES(true, '$2b$12$9AiYSYThoFFQyKIIOhZIXODpoc2iw0WYCljud1pCCdt70BxuLl3Rm');
CREATE TABLE public.login_gateway_attempts (source_key text PRIMARY KEY, failures integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.login_gateway_attempts TO service_role;
ALTER TABLE public.login_gateway_attempts ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.login_gateway_sessions (token uuid PRIMARY KEY DEFAULT gen_random_uuid(), version bigint NOT NULL, expires_at timestamptz NOT NULL DEFAULT now() + interval '8 hours');
GRANT ALL ON public.login_gateway_sessions TO service_role;
ALTER TABLE public.login_gateway_sessions ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.login_gateway_verify(p_password text, p_source_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s public.login_gateway_settings; a public.login_gateway_attempts; receipt uuid;
BEGIN
 IF length(p_password)>128 OR length(p_source_key)<>64 THEN RETURN jsonb_build_object('valid',false); END IF;
 INSERT INTO public.login_gateway_attempts(source_key) VALUES(p_source_key) ON CONFLICT DO NOTHING;
 SELECT * INTO a FROM public.login_gateway_attempts WHERE source_key=p_source_key FOR UPDATE;
 IF a.window_start <= now()-interval '15 minutes' THEN UPDATE public.login_gateway_attempts SET failures=0,window_start=now() WHERE source_key=p_source_key; a.failures:=0; a.window_start:=now(); END IF;
 IF a.failures>=5 THEN RETURN jsonb_build_object('valid',false,'retry_after_seconds',ceil(extract(epoch from (a.window_start+interval '15 minutes'-now())))); END IF;
 SELECT * INTO s FROM public.login_gateway_settings WHERE id=true FOR SHARE;
 IF extensions.crypt(p_password,s.password_hash)<>s.password_hash THEN UPDATE public.login_gateway_attempts SET failures=failures+1 WHERE source_key=p_source_key; RETURN jsonb_build_object('valid',false); END IF;
 UPDATE public.login_gateway_attempts SET failures=0,window_start=now() WHERE source_key=p_source_key;
 DELETE FROM public.login_gateway_sessions WHERE expires_at<now();
 DELETE FROM public.login_gateway_attempts WHERE window_start<now()-interval '1 day';
 INSERT INTO public.login_gateway_sessions(version) VALUES(s.version) RETURNING token INTO receipt;
 RETURN jsonb_build_object('valid',true,'token',receipt);
END $$;
CREATE OR REPLACE FUNCTION public.login_gateway_validate(p_token uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.login_gateway_sessions s JOIN public.login_gateway_settings g ON g.id=true AND s.version=g.version WHERE s.token=p_token AND s.expires_at>now()); $$;
CREATE OR REPLACE FUNCTION public.login_gateway_manage(p_user_id uuid,p_password text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE s public.login_gateway_settings;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=p_user_id AND is_active=true AND role IN ('admin','super_admin')) THEN RAISE EXCEPTION 'Admin or super admin required' USING ERRCODE='42501'; END IF;
 IF p_password IS NOT NULL THEN
 IF length(p_password)<12 OR length(p_password)>128 THEN RAISE EXCEPTION 'Use a password between 12 and 128 characters'; END IF;
 UPDATE public.login_gateway_settings SET password_hash=extensions.crypt(p_password,extensions.gen_salt('bf',12)),version=version+1,updated_at=now(),updated_by=p_user_id WHERE id=true;
 END IF;
 SELECT * INTO s FROM public.login_gateway_settings WHERE id=true;
 RETURN jsonb_build_object('can_manage',true,'updated_at',s.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.login_gateway_verify(text,text), public.login_gateway_validate(uuid), public.login_gateway_manage(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.login_gateway_verify(text,text), public.login_gateway_validate(uuid), public.login_gateway_manage(uuid,text) TO service_role;