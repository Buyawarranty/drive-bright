ALTER TABLE public.agent_feedback
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE POLICY "Staff can upload agent feedback files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agent-feedback' AND public.is_active_admin_user(auth.uid()));

CREATE POLICY "Staff can view agent feedback files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agent-feedback' AND public.is_active_admin_user(auth.uid()));

CREATE POLICY "Staff can delete agent feedback files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'agent-feedback' AND public.is_active_admin_user(auth.uid()));