-- Drop the existing case-sensitive policy
DROP POLICY IF EXISTS "Customers can view own data" ON customers;

-- Create a new case-insensitive policy
CREATE POLICY "Customers can view own data" 
ON customers 
FOR SELECT 
USING (LOWER(email) = LOWER(auth.email()));