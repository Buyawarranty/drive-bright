UPDATE public.customers
SET payment_verified = true, updated_at = now()
WHERE payment_confirmed_by IS NOT NULL
  AND payment_verified IS DISTINCT FROM true;

UPDATE public.customer_policies cp
SET payment_verified = true, updated_at = now()
FROM public.customers c
WHERE cp.customer_id = c.id
  AND c.payment_confirmed_by IS NOT NULL
  AND cp.payment_verified IS DISTINCT FROM true;