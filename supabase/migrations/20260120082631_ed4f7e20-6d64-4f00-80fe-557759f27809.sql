-- Add RLS policy to allow customers to update their own data
CREATE POLICY "Customers can update own data"
ON public.customers
FOR UPDATE
USING (lower(email) = lower(auth.email()))
WITH CHECK (lower(email) = lower(auth.email()));