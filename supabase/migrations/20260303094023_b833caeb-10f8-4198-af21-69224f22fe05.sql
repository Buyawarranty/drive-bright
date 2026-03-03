-- Add explicit INSERT policy for anonymous users (public website form submissions)
-- This ensures Step 2 quote form can always create leads via the anon key
CREATE POLICY "Allow anonymous lead creation from website"
ON public.sales_leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Also add for authenticated users who might submit the form while logged in
CREATE POLICY "Allow authenticated lead creation from website"
ON public.sales_leads
FOR INSERT
TO authenticated
WITH CHECK (true);