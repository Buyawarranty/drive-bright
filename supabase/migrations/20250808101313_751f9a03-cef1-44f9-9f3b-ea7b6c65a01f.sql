-- Insert the missing customer record for WV67 CYL (without ON CONFLICT since there's no unique constraint on warranty_reference_number)
INSERT INTO customers (
  name, email, plan_type, status, stripe_session_id, registration_plate, phone, 
  first_name, last_name, flat_number, building_name, building_number, street, 
  town, postcode, country, vehicle_make, vehicle_model, vehicle_year, 
  vehicle_fuel_type, vehicle_transmission, mileage, payment_type, 
  discount_amount, final_amount, warranty_reference_number
) 
SELECT 
  'Kam Qureshi', 'hello@1ux1.com', 'Electric vehicle ev extended warranty', 'Active', 
  'cs_live_a1yNgRWLmgFxiH75svnoqiecTlZakqm21eQ1jH4gwAuVwJ24v7VqwKLP', 'WV67 CYL', '07960111131',
  'Kam', 'Qureshi', '', 'Harrow', '', '41 Blawith Road', 
  'Middlesex', 'HA1 1TL', 'United Kingdom', 'NISSAN', 'Unknown', '2017',
  'ELECTRICITY', '', '122000', 'yearly',
  0, 296, 'BAW-2508-400008'
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE warranty_reference_number = 'BAW-2508-400008'
);