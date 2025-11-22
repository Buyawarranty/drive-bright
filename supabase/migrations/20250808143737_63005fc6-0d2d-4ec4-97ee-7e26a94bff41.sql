-- Insert default permissions
INSERT INTO public.admin_permissions (permission_key, permission_name, description, category) VALUES
('customers:read', 'View Customers', 'Can view customer information', 'customers'),
('customers:write', 'Manage Customers', 'Can create, update, and delete customers', 'customers'),
('plans:read', 'View Plans', 'Can view warranty plans', 'plans'),
('plans:write', 'Manage Plans', 'Can create, update, and delete plans', 'plans'),
('discount_codes:read', 'View Discount Codes', 'Can view discount codes', 'discounts'),
('discount_codes:write', 'Manage Discount Codes', 'Can create, update, and delete discount codes', 'discounts'),
('analytics:read', 'View Analytics', 'Can access analytics dashboard', 'analytics'),
('email_templates:read', 'View Email Templates', 'Can view email templates', 'emails'),
('email_templates:write', 'Manage Email Templates', 'Can create, update, and delete email templates', 'emails'),
('settings:read', 'View Settings', 'Can view account settings', 'settings'),
('settings:write', 'Manage Settings', 'Can modify account settings', 'settings'),
('users:read', 'View Users', 'Can view admin users', 'users'),
('users:write', 'Manage Users', 'Can invite, update, and remove admin users', 'users');

-- Create function to check admin permissions
CREATE OR REPLACE FUNCTION public.has_admin_permission(user_id UUID, permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    INNER JOIN public.user_roles ur ON ur.user_id = au.user_id
    WHERE au.user_id = $1 
    AND au.is_active = true
    AND (
      ur.role = 'admin' 
      OR (au.permissions->$2)::boolean = true
    )
  );
$$;

-- Create function to generate random password
CREATE OR REPLACE FUNCTION public.generate_random_password()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN array_to_string(ARRAY(
    SELECT chr((ascii('a') + (random() * 25)::int))
    FROM generate_series(1, 4)
  ), '') || '-' || 
  array_to_string(ARRAY(
    SELECT chr((ascii('0') + (random() * 9)::int))
    FROM generate_series(1, 4)
  ), '');
END;
$$;

-- Create trigger for updated_at
CREATE TRIGGER update_admin_users_updated_at
  BEFORE UPDATE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for admin_users
CREATE POLICY "Admins can manage all admin users" 
ON public.admin_users 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own admin profile" 
ON public.admin_users 
FOR SELECT 
USING (user_id = auth.uid());

-- RLS Policies for admin_permissions
CREATE POLICY "Admins can view permissions" 
ON public.admin_permissions 
FOR SELECT 
USING (is_admin(auth.uid()));

-- RLS Policies for admin_invitations
CREATE POLICY "Admins can manage invitations" 
ON public.admin_invitations 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Service role can manage invitations" 
ON public.admin_invitations 
FOR ALL 
USING (true);