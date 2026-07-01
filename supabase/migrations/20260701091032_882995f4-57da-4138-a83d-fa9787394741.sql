
UPDATE public.admin_users SET role = 'accounts_manager' WHERE email = 'accounts@buyawarranty.co.uk';
DELETE FROM public.user_roles WHERE role = 'guest' AND user_id IN (SELECT id FROM auth.users WHERE email = 'accounts@buyawarranty.co.uk');
INSERT INTO public.user_roles (user_id, role)
  SELECT id, 'accounts_manager' FROM auth.users WHERE email = 'accounts@buyawarranty.co.uk'
  ON CONFLICT (user_id, role) DO NOTHING;
DELETE FROM public.user_roles WHERE role = 'accounts' AND user_id IN (SELECT id FROM auth.users WHERE email = 'accounts@buyawarranty.co.uk');
