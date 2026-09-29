CREATE TABLE public.claims_data_access (
  user_id uuid PRIMARY KEY,
  granted_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.claims_data_access TO authenticated;
GRANT ALL ON public.claims_data_access TO service_role;
ALTER TABLE public.claims_data_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_claims_data_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(coalesce(auth.jwt()->>'email','')) IN ('support@buyawarranty.co.uk','info@buyawarranty.co.uk')
$$;

CREATE OR REPLACE FUNCTION public.has_claims_data_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_claims_data_owner()
    OR EXISTS (SELECT 1 FROM public.claims_data_access WHERE user_id = auth.uid())
$$;

CREATE POLICY "Owners see all, users see own" ON public.claims_data_access
FOR SELECT TO authenticated USING (public.is_claims_data_owner() OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_claims_data_access(p_user_id uuid, p_allow boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_claims_data_owner() THEN
    RAISE EXCEPTION 'Only support@ and info@ can change Claims data access';
  END IF;
  IF p_allow THEN
    INSERT INTO public.claims_data_access(user_id, granted_by_email)
    VALUES (p_user_id, auth.jwt()->>'email') ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.claims_data_access WHERE user_id = p_user_id;
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_claims_data_access(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_claims_data_access(uuid, boolean) TO authenticated;