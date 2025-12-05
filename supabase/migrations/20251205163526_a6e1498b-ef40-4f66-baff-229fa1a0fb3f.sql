-- Backfill payment_amount in customer_policies from customers.final_amount
UPDATE customer_policies cp
SET payment_amount = c.final_amount
FROM customers c
WHERE cp.customer_id = c.id
  AND cp.payment_amount IS NULL
  AND c.final_amount IS NOT NULL;