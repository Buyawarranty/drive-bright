
-- Delete duplicate leads that were created by direct frontend insert (no abandoned_cart_id)
-- when a trigger-created lead (with abandoned_cart_id) already exists for the same email
-- within a 1-hour window
DELETE FROM sales_leads
WHERE id IN (
  SELECT sl1.id
  FROM sales_leads sl1
  WHERE sl1.abandoned_cart_id IS NULL
  AND EXISTS (
    SELECT 1 FROM sales_leads sl2
    WHERE sl2.email = sl1.email
    AND sl2.abandoned_cart_id IS NOT NULL
    AND sl2.id != sl1.id
    AND sl2.created_at > sl1.created_at - interval '1 hour'
    AND sl2.created_at < sl1.created_at + interval '1 hour'
  )
);
