REVOKE ALL ON public.lead_access_events FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.lead_access_events TO authenticated;
GRANT ALL ON public.lead_access_events TO service_role;