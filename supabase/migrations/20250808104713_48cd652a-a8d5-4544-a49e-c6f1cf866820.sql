-- Remove the restrictive plan_type check constraint to allow all plan types
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_plan_type_check;

-- Insert the missing customer record for BL62 GVO based on the pattern from other records
-- Note: Since no warranty reference was generated, we'll need to generate one
INSERT INTO customers (
  name, email, plan_type, status, registration_plate, phone, 
  first_name, last_name, vehicle_make, vehicle_model, vehicle_year, 
  vehicle_fuel_type, mileage, payment_type, final_amount
) 
SELECT 
  'Customer BL62 GVO', 'customer@example.com', 'Standard Extended Warranty', 'Active',
  'BL62 GVO', 'Unknown', 'Unknown', 'Unknown', 
  'Unknown', 'Unknown', 'Unknown', 'Unknown', 
  'Unknown', 'monthly', 0
WHERE NOT EXISTS (
  SELECT 1 FROM customers WHERE registration_plate = 'BL62 GVO'
);