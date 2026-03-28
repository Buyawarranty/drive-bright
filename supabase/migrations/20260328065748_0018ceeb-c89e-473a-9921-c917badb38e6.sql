-- Fix RLS policy: use is_admin_or_sales() function like other tables instead of user_roles
DROP POLICY IF EXISTS "Admin users can manage posted letters log" ON public.posted_letters_log;

CREATE POLICY "Admin and sales can manage posted letters log"
  ON public.posted_letters_log
  FOR ALL
  TO authenticated
  USING (is_admin_or_sales(auth.uid()))
  WITH CHECK (is_admin_or_sales(auth.uid()));