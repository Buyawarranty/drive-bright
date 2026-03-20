-- Backfill purchase_source for existing customers based on payment IDs
-- Bumper customers
UPDATE customers SET purchase_source = 'bumper' WHERE (purchase_source IS NULL OR purchase_source = '') AND bumper_order_id IS NOT NULL;

-- Stripe customers (no bumper)
UPDATE customers SET purchase_source = 'stripe' WHERE (purchase_source IS NULL OR purchase_source = '') AND stripe_session_id IS NOT NULL AND bumper_order_id IS NULL;

-- Remaining unknowns default to 'website'
UPDATE customers SET purchase_source = 'website' WHERE (purchase_source IS NULL OR purchase_source = '');