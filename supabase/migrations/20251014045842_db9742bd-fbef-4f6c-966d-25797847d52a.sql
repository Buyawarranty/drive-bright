-- Add admin access policy for customer_policies table
CREATE POLICY "Admins can manage all policies"
ON public.customer_policies
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin access policy for customers table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' 
    AND policyname = 'Admins can view all customers'
  ) THEN
    CREATE POLICY "Admins can view all customers"
    ON public.customers
    FOR SELECT
    TO authenticated
    USING (public.is_admin(auth.uid()));
  END IF;
END $$;