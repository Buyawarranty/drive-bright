-- Allow authenticated users to insert callback requests into abandoned_carts as well
CREATE POLICY "Allow authenticated callback requests" 
ON public.abandoned_carts 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Allow inserts that are callback requests (have the specific metadata pattern)
  cart_metadata->>'request_type' = 'urgent_callback'
);