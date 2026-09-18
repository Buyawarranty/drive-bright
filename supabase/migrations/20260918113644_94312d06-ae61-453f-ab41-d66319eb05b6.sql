REVOKE ALL ON FUNCTION public.orr_offer_lead_to_next(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.orr_offer_lead_to_next(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.open_pool_log_outcome(uuid, uuid, text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_pool_log_outcome(uuid, uuid, text, text, timestamptz) TO authenticated, service_role;