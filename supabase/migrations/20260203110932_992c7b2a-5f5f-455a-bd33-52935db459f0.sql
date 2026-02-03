-- Reassign all sales_leads from Lucas to James
UPDATE sales_leads 
SET assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5', 
    updated_at = now()
WHERE assigned_to = '2314a13b-157f-4d5a-adc1-3925cbc68725';

-- Reassign all abandoned_carts from Lucas to James
UPDATE abandoned_carts 
SET contacted_by = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5', 
    updated_at = now()
WHERE contacted_by = '2314a13b-157f-4d5a-adc1-3925cbc68725';