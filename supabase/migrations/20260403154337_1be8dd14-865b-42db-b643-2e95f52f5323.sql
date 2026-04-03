
-- One-time cleanup: update any leads where the customer already has an active policy
-- This catches leads created before the active-policy guard was deployed
UPDATE public.sales_leads sl
SET 
  status = 'converted',
  notes = COALESCE(notes || E'\n', '') || '[System] Auto-closed: customer already has active policy',
  updated_at = now()
WHERE sl.status NOT IN ('converted', 'lost', 'fake_lead')
  AND EXISTS (
    SELECT 1 
    FROM public.customer_policies cp
    WHERE lower(btrim(cp.email)) = lower(btrim(sl.email))
      AND COALESCE(cp.is_deleted, false) = false
      AND cp.status IN ('active', 'scheduled')
  );
