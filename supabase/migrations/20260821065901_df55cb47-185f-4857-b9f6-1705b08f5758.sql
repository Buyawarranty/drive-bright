ALTER TABLE public.ai_sandbox_threads ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.ai_sandbox_threads ADD COLUMN IF NOT EXISTS guest_token text;
ALTER TABLE public.ai_sandbox_threads ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS idx_ai_sandbox_threads_guest ON public.ai_sandbox_threads(guest_token) WHERE guest_token IS NOT NULL;

ALTER TABLE public.ai_sandbox_messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.ai_sandbox_handovers ALTER COLUMN created_by DROP NOT NULL;

-- Website visitors (not signed in) may see which specialists are on duty so the
-- widget can say "a specialist is online now". Only presence flags are exposed.
GRANT SELECT ON public.ai_sandbox_specialist_presence TO anon;
DROP POLICY IF EXISTS "Anyone can see who is on duty" ON public.ai_sandbox_specialist_presence;
CREATE POLICY "Anyone can see who is on duty"
ON public.ai_sandbox_specialist_presence FOR SELECT TO anon
USING (true);