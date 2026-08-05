-- Greg must be a new-leads agent on Team Blue
UPDATE public.lead_team_members
SET workstream_new_leads = true
WHERE admin_user_id = 'b4d05a56-bb06-4bf1-8832-670f840a5261';

-- Clean, interleaved rotation order: James (Red), Greg (Blue), Thomas (Red), Freddie (Blue)
UPDATE public.agent_distribution_caps SET sort_order = 1 WHERE admin_user_id = '019299c4-4bb3-4cfc-b205-0d6cd4f64dd5';
UPDATE public.agent_distribution_caps SET sort_order = 2 WHERE admin_user_id = 'b4d05a56-bb06-4bf1-8832-670f840a5261';
UPDATE public.agent_distribution_caps SET sort_order = 3 WHERE admin_user_id = '98dc0e81-9f83-45b9-8c98-e7875b314dec';
UPDATE public.agent_distribution_caps SET sort_order = 4 WHERE admin_user_id = 'd48ba5c6-999d-4ae1-b9bf-1a16120cd202';