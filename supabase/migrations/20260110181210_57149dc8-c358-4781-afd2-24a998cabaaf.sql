-- Add DELETE policy for sales users to delete their assigned leads
CREATE POLICY "Sales users can delete assigned leads"
ON public.sales_leads
FOR DELETE
USING (
  (assigned_to IN (
    SELECT admin_users.id
    FROM admin_users
    WHERE admin_users.user_id = auth.uid()
  ))
  OR is_admin(auth.uid())
);