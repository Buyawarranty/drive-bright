-- Fix: Add anon INSERT policy for abandoned_carts so frontend cart tracking works
-- This was missing, causing all non-callback cart inserts from the website to be silently blocked by RLS

CREATE POLICY "Allow anonymous cart tracking inserts"
ON public.abandoned_carts
FOR INSERT
TO anon
WITH CHECK (true);

-- Also add anon UPDATE policy so Step 2 can update existing carts found by vehicle_reg
CREATE POLICY "Allow anonymous cart tracking updates"  
ON public.abandoned_carts
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Also add anon SELECT policy so frontend can find existing carts by vehicle_reg
CREATE POLICY "Allow anonymous cart lookup by vehicle reg"
ON public.abandoned_carts
FOR SELECT
TO anon
USING (true);