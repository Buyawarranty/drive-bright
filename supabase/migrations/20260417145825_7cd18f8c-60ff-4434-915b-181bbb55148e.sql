UPDATE public.abandoned_carts ac
SET contacted_by = au.user_id
FROM public.sales_leads sl
JOIN public.admin_users au ON au.id = sl.assigned_to
WHERE ac.contacted_by IS NULL
  AND ac.created_at > now() - interval '3 days'
  AND au.user_id IS NOT NULL
  AND lower(sl.email) = lower(ac.email);