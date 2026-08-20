ALTER TABLE public.ai_sandbox_specialist_presence
  ADD COLUMN IF NOT EXISTS override_hours boolean NOT NULL DEFAULT false;