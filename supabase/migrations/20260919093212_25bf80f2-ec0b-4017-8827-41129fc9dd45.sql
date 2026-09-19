ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deferred_bumper_link TEXT,
  ADD COLUMN IF NOT EXISTS deferred_agent_reminders_sent JSONB NOT NULL DEFAULT '[]'::jsonb;