-- Add electric vehicle plans to allowed plan types
INSERT INTO plans (name, monthly_price, yearly_price, two_yearly_price, three_yearly_price, coverage, is_active) 
VALUES 
  ('Electric vehicle ev extended warranty', 26.00, 296.00, 592.00, 888.00, '["Breakdown cover", "Extended warranty"]'::jsonb, true);

-- Remove the restrictive check constraint on customers table that's blocking EV plans
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_plan_type_check;

-- Remove the restrictive check constraint on customer_policies table that's blocking EV plans  
ALTER TABLE customer_policies DROP CONSTRAINT IF EXISTS customer_policies_plan_type_check;