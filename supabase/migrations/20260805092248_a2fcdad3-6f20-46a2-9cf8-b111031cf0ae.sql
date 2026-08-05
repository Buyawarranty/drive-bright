-- 1. Grant Greg the Recontact Leads tab
UPDATE public.admin_users
SET permissions = jsonb_set(coalesce(permissions, '{}'::jsonb), '{tab_recontact-leads}', 'true'::jsonb),
    updated_at = now()
WHERE id = 'b4d05a56-bb06-4bf1-8832-670f840a5261';

-- 2. Enable the recontact workstream on his lead team membership
UPDATE public.lead_team_members
SET workstream_recontact = true
WHERE admin_user_id = 'b4d05a56-bb06-4bf1-8832-670f840a5261';

-- 3. Ensure he has an unblocked recontact cap row
INSERT INTO public.recontact_agent_caps (admin_user_id, daily_cap, blocked, note)
VALUES ('b4d05a56-bb06-4bf1-8832-670f840a5261', 20, false, 'Greg back from leave - recontact access restored')
ON CONFLICT (admin_user_id) DO UPDATE
SET blocked = false,
    daily_cap = COALESCE(public.recontact_agent_caps.daily_cap, 20),
    note = 'Greg back from leave - recontact access restored',
    updated_at = now();