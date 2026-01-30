-- Reassign all leads from Lucas to James
UPDATE public.sales_leads 
SET assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5'
WHERE assigned_to = '2314a13b-157f-4d5a-adc1-3925cbc68725';

-- Remove Lucas from the distribution caps (if desired)
DELETE FROM public.agent_distribution_caps 
WHERE admin_user_id = '2314a13b-157f-4d5a-adc1-3925cbc68725';