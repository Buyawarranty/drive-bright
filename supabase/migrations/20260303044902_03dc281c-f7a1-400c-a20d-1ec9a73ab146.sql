-- Start next round-robin assignment from James by setting pointer to Ash
UPDATE public.round_robin_state rrs
SET last_assigned_user_id = au.id,
    updated_at = now()
FROM public.admin_users au
WHERE lower(au.first_name) = 'ash'
  AND au.is_active = true
  AND au.role IN ('sales', 'sales_lead');