
CREATE OR REPLACE FUNCTION public.has_tab_access(_user_id uuid, _tab text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND is_active = true
      AND (
        role IN ('admin','super_admin','dev_tester')
        OR (permissions ->> ('tab_' || _tab)) = 'true'
      )
  );
$$;

DROP POLICY IF EXISTS "Admins can manage claims submissions" ON public.claims_submissions;
CREATE POLICY "Staff with claims access can manage claims submissions"
ON public.claims_submissions
FOR ALL
USING (public.has_tab_access(auth.uid(), 'claims'))
WITH CHECK (public.has_tab_access(auth.uid(), 'claims'));
