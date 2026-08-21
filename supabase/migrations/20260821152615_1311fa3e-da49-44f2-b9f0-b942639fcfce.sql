UPDATE public.admin_users SET role = 'super_admin' WHERE lower(email) = 'support@buyawarranty.co.uk';
DELETE FROM public.user_roles WHERE user_id = (SELECT user_id FROM public.admin_users WHERE lower(email) = 'support@buyawarranty.co.uk') AND role::text IN ('sales','member');
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'super_admin'::public.user_role FROM public.admin_users WHERE lower(email) = 'support@buyawarranty.co.uk'
ON CONFLICT (user_id, role) DO NOTHING;