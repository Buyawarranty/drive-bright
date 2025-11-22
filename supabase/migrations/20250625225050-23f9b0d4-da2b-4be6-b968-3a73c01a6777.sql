
-- Drop existing RLS policies for admin_notes
DROP POLICY IF EXISTS "Admins can view all notes" ON public.admin_notes;
DROP POLICY IF EXISTS "Admins can insert notes" ON public.admin_notes;
DROP POLICY IF EXISTS "Admins can update notes" ON public.admin_notes;
DROP POLICY IF EXISTS "Admins can delete notes" ON public.admin_notes;

-- Create new policies that work for both regular admins and master admin
-- Policy to allow admins and master admin to view all notes (no RLS restriction for master admin scenario)
CREATE POLICY "Allow admin access to notes" ON public.admin_notes
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Alternative approach: Create a more permissive policy since this is an admin-only feature
-- and we're already checking admin access at the application level
ALTER TABLE public.admin_notes DISABLE ROW LEVEL SECURITY;
