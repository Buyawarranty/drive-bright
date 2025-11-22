-- Fix customer policies visibility by allowing users to see policies by email as well as user_id
-- First, let's create a better RLS policy for customer_policies

-- Drop existing user policies
DROP POLICY IF EXISTS "Users can view their own policies" ON customer_policies;
DROP POLICY IF EXISTS "Users can update their own policies" ON customer_policies;

-- Create new policies that allow access by both user_id and email
CREATE POLICY "Users can view their own policies by user_id or email" 
ON customer_policies 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  email = auth.email()
);

CREATE POLICY "Users can update their own policies by user_id or email" 
ON customer_policies 
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  email = auth.email()
);

-- Update policies with null user_id to link them to the correct user
-- This will link policies to users based on matching email addresses
UPDATE customer_policies 
SET user_id = auth_users.id
FROM auth.users as auth_users
WHERE customer_policies.user_id IS NULL 
AND customer_policies.email = auth_users.email;