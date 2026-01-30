
-- Also add policy for abandoned_carts since leads come from there
CREATE POLICY "Sales users can view assigned abandoned carts"
ON public.abandoned_carts
FOR SELECT
TO authenticated
USING (
  contacted_by IN (
    SELECT id FROM admin_users WHERE user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Add update policy for abandoned carts for sales users
CREATE POLICY "Sales users can update abandoned carts"
ON public.abandoned_carts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  )
);
