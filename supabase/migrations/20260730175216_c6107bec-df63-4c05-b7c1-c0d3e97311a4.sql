CREATE OR REPLACE FUNCTION public.derive_lead_source(p_cart_metadata jsonb)
RETURNS lead_source
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v text;
BEGIN
  IF p_cart_metadata IS NULL THEN
    RETURN 'website'::lead_source;
  END IF;

  IF COALESCE(p_cart_metadata->>'gclid', '') <> '' THEN
    v := 'google_ad';
  ELSIF COALESCE(p_cart_metadata->>'msclkid', '') <> '' THEN
    v := 'bing_ad';
  ELSIF COALESCE(p_cart_metadata->>'fbclid', '') <> '' THEN
    v := 'social_ad';
  ELSE
    v := 'website';
  END IF;

  RETURN v::lead_source;
END;
$function$;