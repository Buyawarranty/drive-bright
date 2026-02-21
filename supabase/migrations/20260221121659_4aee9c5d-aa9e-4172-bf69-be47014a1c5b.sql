-- Mark abandoned_carts as converted where a matching sales_lead already exists
-- This prevents existing duplicates from showing in the admin dashboard
UPDATE abandoned_carts ac
SET is_converted = true, updated_at = now()
WHERE is_converted = false
AND EXISTS (
  SELECT 1 FROM sales_leads sl WHERE LOWER(sl.email) = LOWER(ac.email)
);