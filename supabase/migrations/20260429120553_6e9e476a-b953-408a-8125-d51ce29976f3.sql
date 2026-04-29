UPDATE public.sales_leads sl
SET lead_source = public.derive_lead_source(ac.cart_metadata)
FROM public.abandoned_carts ac
WHERE sl.abandoned_cart_id = ac.id
  AND sl.created_at >= '2026-03-23'
  AND sl.lead_source IS DISTINCT FROM public.derive_lead_source(ac.cart_metadata);