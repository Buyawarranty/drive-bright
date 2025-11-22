-- Add admin role for test@customer.com user
INSERT INTO public.user_roles (user_id, role)
VALUES ('b1c84f59-db07-4cef-bcd6-0a03ae933ecc', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;