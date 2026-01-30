-- Deactivate Lucas Knight's account
UPDATE public.admin_users 
SET is_active = false, updated_at = now()
WHERE email = 'Lucas.Knight@buyawarranty.co.uk';

-- Reassign all of Lucas's leads to James Reed
UPDATE public.sales_leads 
SET assigned_to = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5', -- James Reed's ID
    updated_at = now()
WHERE assigned_to = '2314a13b-157f-4d5a-adc1-3925cbc68725'; -- Lucas's ID

-- Also pause Lucas in agent_distribution_caps so he can't receive new leads
UPDATE public.agent_distribution_caps
SET paused = true, updated_at = now()
WHERE admin_user_id = '2314a13b-157f-4d5a-adc1-3925cbc68725';