-- Add UPDATE policy for abandoned_carts so admins can assign leads
CREATE POLICY "Admins can update abandoned carts" 
ON public.abandoned_carts 
FOR UPDATE 
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));