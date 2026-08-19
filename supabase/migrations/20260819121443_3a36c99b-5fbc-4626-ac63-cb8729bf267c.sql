UPDATE public.admin_users
SET role = 'super_admin', updated_at = now()
WHERE lower(email) = 'support@buyawarranty.co.uk';

INSERT INTO public.user_roles (user_id, role)
SELECT au.user_id, 'super_admin'
FROM public.admin_users au
WHERE lower(au.email) = 'support@buyawarranty.co.uk' AND au.user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;