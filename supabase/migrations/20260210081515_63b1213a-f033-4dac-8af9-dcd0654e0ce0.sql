-- Remove the incorrect 'member' role and add 'sales' role for Jas
DELETE FROM public.user_roles 
WHERE user_id = '64da6999-3006-4ffb-b3d1-afaf8847641c' AND role = 'member';

INSERT INTO public.user_roles (user_id, role) 
VALUES ('64da6999-3006-4ffb-b3d1-afaf8847641c', 'sales')
ON CONFLICT (user_id, role) DO NOTHING;

-- Ensure admin_users role is also 'sales'
UPDATE public.admin_users 
SET role = 'sales', updated_at = now() 
WHERE email = 'jas@buyawarranty.co.uk' AND role != 'sales';