ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS msclkid text,
  ADD COLUMN IF NOT EXISTS ttclid text;

-- Backfill click ids + utm from the originating cart (match on normalised email or reg plate)
WITH cart AS (
  SELECT
    lower(trim(ac.email)) AS email_key,
    upper(replace(coalesce(ac.vehicle_reg,''),' ','')) AS reg_key,
    ac.cart_metadata->>'msclkid' AS msclkid,
    ac.cart_metadata->>'ttclid' AS ttclid,
    ac.cart_metadata->>'utm_source' AS utm_source,
    ac.cart_metadata->>'utm_campaign' AS utm_campaign,
    ac.created_at
  FROM public.abandoned_carts ac
  WHERE ac.cart_metadata->>'msclkid' IS NOT NULL
     OR ac.cart_metadata->>'ttclid' IS NOT NULL
     OR lower(coalesce(ac.cart_metadata->>'utm_source','')) LIKE ANY (ARRAY['%bing%','%microsoft%','%msn%','%tiktok%'])
), matched AS (
  SELECT DISTINCT ON (c.id)
    c.id,
    cart.msclkid, cart.ttclid, cart.utm_source, cart.utm_campaign
  FROM public.customers c
  JOIN cart ON (
    (cart.email_key <> '' AND cart.email_key = lower(trim(c.email)))
    OR (cart.reg_key <> '' AND cart.reg_key = upper(replace(coalesce(c.registration_plate,''),' ','')))
  )
  ORDER BY c.id, cart.created_at DESC
)
UPDATE public.customers c
SET msclkid = coalesce(c.msclkid, m.msclkid),
    ttclid = coalesce(c.ttclid, m.ttclid),
    utm_source = coalesce(nullif(c.utm_source,''), m.utm_source),
    utm_campaign = coalesce(nullif(c.utm_campaign,''), m.utm_campaign)
FROM matched m
WHERE m.id = c.id;

-- Correct acquisition_source for historic Bing sales
UPDATE public.customers
SET acquisition_source = 'bing_ad'
WHERE coalesce(acquisition_source,'') NOT IN ('bing_ad','bing_ads')
  AND (
    coalesce(msclkid,'') <> ''
    OR lower(coalesce(utm_source,'')) LIKE '%bing%'
    OR lower(coalesce(utm_source,'')) LIKE '%microsoft%'
    OR lower(coalesce(utm_source,'')) LIKE '%msn%'
  );

-- Correct acquisition_source for historic TikTok sales
UPDATE public.customers
SET acquisition_source = 'tiktok_ad'
WHERE coalesce(acquisition_source,'') NOT IN ('tiktok_ad','tiktok_ads')
  AND (
    coalesce(ttclid,'') <> ''
    OR lower(coalesce(utm_source,'')) LIKE '%tiktok%'
  );