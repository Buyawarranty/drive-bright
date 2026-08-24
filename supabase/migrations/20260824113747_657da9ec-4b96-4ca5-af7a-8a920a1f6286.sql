REVOKE ALL ON FUNCTION public.marketing_customer_state(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marketing_customer_state(text) TO service_role;