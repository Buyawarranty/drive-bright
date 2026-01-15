-- Fix Alexander McGrath's record: correct registration plate and unify warranty reference
UPDATE customers 
SET registration_plate = 'EMZ2864'
WHERE id = '325b5e1c-c431-4054-ad1c-358388c10f66';

UPDATE customer_policies 
SET policy_number = 'BAW-1501-400901'
WHERE customer_id = '325b5e1c-c431-4054-ad1c-358388c10f66';