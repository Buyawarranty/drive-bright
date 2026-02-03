-- Allow anonymous users to insert callback requests into abandoned_carts
CREATE POLICY "Allow anonymous callback requests" 
ON public.abandoned_carts 
FOR INSERT 
TO anon
WITH CHECK (
  -- Only allow inserts that are callback requests (have the specific metadata pattern)
  cart_metadata->>'request_type' = 'urgent_callback'
);