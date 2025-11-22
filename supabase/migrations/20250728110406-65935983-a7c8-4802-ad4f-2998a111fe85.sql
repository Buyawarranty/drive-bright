-- Create function to automatically assign admin role to the main admin email
CREATE OR REPLACE FUNCTION public.assign_admin_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if this is the main admin email
  IF NEW.email = 'info@buyawarranty.co.uk' THEN
    -- Insert admin role for this user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically assign admin role when main admin signs up
DROP TRIGGER IF EXISTS auto_assign_admin_role ON auth.users;
CREATE TRIGGER auto_assign_admin_role
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.assign_admin_role();

-- Also create a manual function to assign admin role to existing users
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Find the user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email;
  
  IF target_user_id IS NOT NULL THEN
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'admin'::user_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END;
$$;