-- Create a function to fix user roles (remove admin, ensure customer role exists)
CREATE OR REPLACE FUNCTION fix_customer_role(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove admin role if exists
  DELETE FROM user_roles 
  WHERE user_id = p_user_id AND role IN ('admin', 'member', 'viewer', 'guest');
  
  -- This function just removes admin roles
  -- Customers don't need a role in user_roles table
  -- The auth system defaults to customer when no role is found
END;
$$;

-- Fix the specific user that has wrong role
SELECT fix_customer_role('15da9cd0-0855-463e-aeab-ceec6c3f472d');