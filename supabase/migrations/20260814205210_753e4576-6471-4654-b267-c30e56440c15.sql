GRANT SELECT ON public.ai_sandbox_specialist_presence TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_sandbox_specialist_presence TO authenticated;
GRANT ALL ON public.ai_sandbox_specialist_presence TO service_role;

DROP POLICY IF EXISTS "Anyone can view specialist presence" ON public.ai_sandbox_specialist_presence;
CREATE POLICY "Anyone can view specialist presence"
ON public.ai_sandbox_specialist_presence
FOR SELECT TO anon
USING (true);