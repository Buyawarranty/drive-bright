-- Add electric vehicle plans to allowed plan types
INSERT INTO plans (name, monthly_price, yearly_price, two_yearly_price, three_yearly_price, coverage, is_active) 
VALUES 
  ('Electric vehicle ev extended warranty', 26.00, 296.00, 592.00, 888.00, '["Breakdown cover", "Extended warranty"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;

-- Remove the restrictive check constraint on customers table that's blocking EV plans
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_plan_type_check;

-- Remove the restrictive check constraint on customer_policies table that's blocking EV plans  
ALTER TABLE customer_policies DROP CONSTRAINT IF EXISTS customer_policies_plan_type_check;

-- Insert the missing customer record
INSERT INTO customers (
  name, email, plan_type, status, stripe_session_id, registration_plate, phone, 
  first_name, last_name, flat_number, building_name, building_number, street, 
  town, postcode, country, vehicle_make, vehicle_model, vehicle_year, 
  vehicle_fuel_type, vehicle_transmission, mileage, payment_type, 
  discount_amount, final_amount, warranty_reference_number
) VALUES (
  'Kam Qureshi', 'hello@1ux1.com', 'Electric vehicle ev extended warranty', 'Active', 
  'cs_live_a1yNgRWLmgFxiH75svnoqiecTlZakqm21eQ1jH4gwAuVwJ24v7VqwKLP', 'WV67 CYL', '07960111131',
  'Kam', 'Qureshi', '', 'Harrow', '', '41 Blawith Road', 
  'Middlesex', 'HA1 1TL', 'United Kingdom', 'NISSAN', 'Unknown', '2017',
  'ELECTRICITY', '', '122000', 'yearly',
  0, 296, 'BAW-2508-400008'
) ON CONFLICT (warranty_reference_number) DO NOTHING;