-- Drop the restrictive sales update policy
DROP POLICY IF EXISTS "Sales can update customers they work with" ON public.customers;

-- Create a new policy allowing all sales/admin staff to update any customer
CREATE POLICY "Sales and admin can update all customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (is_admin_or_sales(auth.uid()))
WITH CHECK (is_admin_or_sales(auth.uid()));