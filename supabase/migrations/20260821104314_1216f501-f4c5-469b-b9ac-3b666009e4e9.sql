-- Applicant CVs: private bucket, admin-staff read only
CREATE POLICY "Admin staff can read career CVs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'career-cvs'
  AND public.is_active_admin_user((select auth.uid()))
);

CREATE POLICY "Admins can delete career CVs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'career-cvs'
  AND public.is_admin((select auth.uid()))
);

-- The working-day helper is server-side plumbing only.
REVOKE EXECUTE ON FUNCTION public.add_working_days(timestamptz, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_career_application() FROM anon, authenticated;