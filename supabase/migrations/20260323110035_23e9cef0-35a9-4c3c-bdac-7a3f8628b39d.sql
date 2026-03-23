-- Grant Ash the all-leads permission so he can see all leads immediately
UPDATE admin_users 
SET permissions = permissions || '{"tab_new-leads_all-leads": true}'::jsonb 
WHERE id = '7083d831-4634-47a4-b3e2-61ac9908bf85';

-- Also flip the global toggle to false (new default = agents can't see all leads)
UPDATE admin_config SET config_value = false WHERE config_key = 'agents_own_leads_only';
