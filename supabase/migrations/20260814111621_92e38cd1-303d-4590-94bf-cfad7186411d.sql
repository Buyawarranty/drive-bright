GRANT SELECT ON public.mot_history TO authenticated;
CREATE POLICY "Staff can read MOT history"
ON public.mot_history
FOR SELECT
TO authenticated
USING (public.is_staff());