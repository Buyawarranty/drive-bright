-- Update the existing customer record BAW-2509-400313 with correct values
UPDATE customers 
SET 
  voluntary_excess = 150,
  claim_limit = 750,
  breakdown_recovery = true,
  vehicle_rental = true,
  tyre_cover = true,
  mot_fee = true
WHERE warranty_reference_number = 'BAW-2509-400313';

-- Update the existing policy record BAW-2509-400313 with correct values  
UPDATE customer_policies 
SET 
  claim_limit = 750,
  breakdown_recovery = true,
  vehicle_rental = true,
  tyre_cover = true,
  mot_fee = true
WHERE policy_number = 'BAW-2509-400313';

-- Re-send the corrected data to Warranties 2000 by updating the status
UPDATE customer_policies
SET warranties_2000_status = 'pending'
WHERE policy_number = 'BAW-2509-400313';