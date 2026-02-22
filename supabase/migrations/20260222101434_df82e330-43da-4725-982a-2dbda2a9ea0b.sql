
-- Mark all abandoned_carts as converted where a matching sales_lead already exists
-- This cleans up existing duplicates in the admin dashboard
UPDATE abandoned_carts ac
SET is_converted = true, updated_at = now()
WHERE ac.is_converted = false
AND EXISTS (
  SELECT 1 FROM sales_leads sl 
  WHERE LOWER(sl.email) = LOWER(ac.email)
);
