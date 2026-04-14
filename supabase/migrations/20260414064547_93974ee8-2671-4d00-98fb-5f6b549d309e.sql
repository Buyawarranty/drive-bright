
-- Update derive_lead_source to recognize fb_referrer and utm_source from Facebook
CREATE OR REPLACE FUNCTION public.derive_lead_source(p_cart_metadata jsonb)
RETURNS lead_source
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'gclid') IS NOT NULL AND (p_cart_metadata->>'gclid') != '' THEN 'google_ad'::lead_source
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'fbclid') IS NOT NULL AND (p_cart_metadata->>'fbclid') != '' THEN 'social_ad'::lead_source
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'fb_referrer') IS NOT NULL AND (p_cart_metadata->>'fb_referrer') != '' THEN 'social_ad'::lead_source
    WHEN p_cart_metadata IS NOT NULL AND (p_cart_metadata->>'utm_source') IN ('facebook', 'fb', 'ig', 'instagram') THEN 'social_ad'::lead_source
    ELSE 'website'::lead_source
  END;
$$;
