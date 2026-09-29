REVOKE EXECUTE ON FUNCTION public.is_claims_data_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_claims_data_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_claims_data_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_claims_data_access() TO authenticated;