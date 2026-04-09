-- Backfill customer_full_name on customer_policies from customers table where it's NULL
UPDATE customer_policies cp
SET customer_full_name = c.name
FROM customers c
WHERE cp.customer_id = c.id
AND cp.customer_full_name IS NULL
AND c.name IS NOT NULL;