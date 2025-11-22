-- Security Fix: Restrict abandoned_carts table to admin-only access
-- Drop any existing policies that might allow public access
DROP POLICY IF EXISTS "Admins can view abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Service role can manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can insert abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Public can view abandoned carts" ON public.abandoned_carts;

-- Ensure RLS is enabled
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies: Only admins can SELECT
CREATE POLICY "Admins can view abandoned carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Service role can manage all operations (for edge functions)
CREATE POLICY "Service role can manage abandoned carts"
ON public.abandoned_carts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- No public INSERT policy - edge functions use service role
-- This prevents any direct public access to customer contact data