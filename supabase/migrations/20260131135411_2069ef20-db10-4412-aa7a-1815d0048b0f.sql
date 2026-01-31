-- Fix RLS policy to allow sales users to insert and update customers
-- The current "Admins can manage customers" policy only allows role='admin'
-- but sales staff (role='sales') also need to create/update customer records when confirming payments

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;

-- Create separate policies for better control

-- Admins can do everything
CREATE POLICY "Admins can manage all customers" 
ON public.customers 
FOR ALL 
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Sales users can INSERT new customers (for payment confirmation)
CREATE POLICY "Sales can insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (is_admin_or_sales(auth.uid()));

-- Sales users can UPDATE customers they are assigned to OR are confirming payment for
-- This extends the existing update policy to also work with the assigned_to field from the INSERT
CREATE POLICY "Sales can update customers they work with" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (
  is_admin_or_sales(auth.uid()) AND (
    -- They assigned the customer
    assigned_to IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR 
    -- They confirmed payment
    payment_confirmed_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR
    -- They sent the quote
    quote_sent_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
  )
)
WITH CHECK (
  is_admin_or_sales(auth.uid()) AND (
    assigned_to IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR 
    payment_confirmed_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
    OR
    quote_sent_by IN (SELECT id FROM admin_users WHERE user_id = auth.uid())
  )
);

-- Drop the old sales update policy since we're replacing it with a better one
DROP POLICY IF EXISTS "Sales users can update assigned customers" ON public.customers;