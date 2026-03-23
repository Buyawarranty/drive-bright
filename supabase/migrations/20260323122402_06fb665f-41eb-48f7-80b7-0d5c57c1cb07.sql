-- Create a security definer function to check if a sales agent has the all-leads permission
CREATE OR REPLACE FUNCTION public.has_all_leads_permission(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND (permissions->>'tab_new-leads_all-leads')::boolean = true
  );
$$;

-- Add RLS policy: sales agents with all-leads permission can view ALL leads
CREATE POLICY "Sales agents with all-leads permission can view all leads"
ON public.sales_leads
FOR SELECT
TO authenticated
USING (
  public.has_all_leads_permission(auth.uid())
);