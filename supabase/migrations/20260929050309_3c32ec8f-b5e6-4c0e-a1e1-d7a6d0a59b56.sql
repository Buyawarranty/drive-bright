REVOKE EXECUTE ON FUNCTION public.renewal_eligibility_reasons(uuid) FROM authenticated;

ALTER FUNCTION public.review_renewal(uuid, text, text) SECURITY INVOKER;