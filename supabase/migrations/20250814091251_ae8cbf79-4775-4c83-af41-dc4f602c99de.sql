-- Ensure admin_users table has the current authenticated users
-- This will help with the assignment functionality

-- First, create a function to automatically add authenticated users to admin_users table
CREATE OR REPLACE FUNCTION ensure_admin_user_exists()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into admin_users if user has admin role
  INSERT INTO public.admin_users (user_id, email, first_name, last_name, role, is_active)
  SELECT 
    NEW.user_id,
    u.email,
    (u.raw_user_meta_data->>'first_name'),
    (u.raw_user_meta_data->>'last_name'),
    NEW.role,
    true
  FROM auth.users u
  WHERE u.id = NEW.user_id
  AND NEW.role = 'admin'
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    is_active = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically populate admin_users when user_roles is updated
DROP TRIGGER IF EXISTS ensure_admin_user_trigger ON public.user_roles;
CREATE TRIGGER ensure_admin_user_trigger
  AFTER INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_admin_user_exists();

-- Populate existing admin users that might be missing
INSERT INTO public.admin_users (user_id, email, first_name, last_name, role, is_active)
SELECT 
  ur.user_id,
  u.email,
  (u.raw_user_meta_data->>'first_name'),
  (u.raw_user_meta_data->>'last_name'),
  ur.role,
  true
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
AND NOT EXISTS (
  SELECT 1 FROM public.admin_users au WHERE au.user_id = ur.user_id
);