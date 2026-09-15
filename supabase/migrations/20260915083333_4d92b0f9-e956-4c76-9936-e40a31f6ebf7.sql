INSERT INTO public.recontact_agent_caps (admin_user_id, can_self_assign, blocked, daily_cap, note)
VALUES ('e60b8a3b-ed0d-4b04-8acb-bcc06f2eba50', true, false, 100, 'Enabled bulk recontact claiming (up to 100/day)')
ON CONFLICT (admin_user_id) DO UPDATE
SET can_self_assign = true,
    blocked = false,
    daily_cap = GREATEST(COALESCE(public.recontact_agent_caps.daily_cap, 0), 100),
    updated_at = now();