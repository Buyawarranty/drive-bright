
-- First, let's see what policies exist on the customers table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'customers';

-- Drop existing policies if they exist to recreate them properly
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Allow master admin access" ON public.customers;

-- Create policy for authenticated admin users
CREATE POLICY "Admins can manage customers"
  ON public.customers
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create policy for anonymous access (master admin mode)
CREATE POLICY "Allow master admin access"
  ON public.customers
  FOR ALL
  TO anon
  USING (true);
