-- Fix customer KS12POA vehicle data from MOT history
UPDATE customers 
SET vehicle_make = 'MERCEDES-BENZ', 
    vehicle_model = 'B-CLASS',
    vehicle_fuel_type = 'Petrol',
    vehicle_year = '2012',
    updated_at = now()
WHERE id = 'c94015b7-46b2-4f58-a98e-e23765e83fda'
AND vehicle_make = 'Unknown';