-- Update the policy record for DV67 YFW to have correct voluntary excess
UPDATE customer_policies 
SET voluntary_excess = 150 
WHERE customer_id = '2ab458f9-7041-47d5-867f-a3ae40ab78f3';