-- Create a test user directly with confirmed email
-- First, let's update the existing customer policy to use a proper email
UPDATE public.customer_policies 
SET email = 'customer2@gmail.com', user_id = 'b1c84f59-db07-4cef-bcd6-0a03ae933ecc'
WHERE email = 'customer2@test.com';