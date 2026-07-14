
-- 1) admin_users.sip_extension for mapping Zoiper extension -> user
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS sip_extension text;
CREATE INDEX IF NOT EXISTS idx_admin_users_sip_extension
  ON public.admin_users(sip_extension);

-- 2) Zoiper call events
CREATE TABLE IF NOT EXISTS public.zoiper_call_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_call_id text UNIQUE,
  agent_email text,
  agent_extension text,
  agent_user_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  direction text NOT NULL DEFAULT 'outbound',
  status text NOT NULL DEFAULT 'answered',
  dialed_number text,
  caller_number text,
  started_at timestamptz NOT NULL,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  talk_seconds integer,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.zoiper_call_events TO authenticated;
GRANT ALL ON public.zoiper_call_events TO service_role;

ALTER TABLE public.zoiper_call_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated staff row that has an admin_users row can read; the UI
-- and tab-permissions gate control who actually sees the section.
CREATE POLICY "Staff can read call events"
  ON public.zoiper_call_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_zoiper_call_events_agent_started
  ON public.zoiper_call_events(agent_user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_zoiper_call_events_started_at
  ON public.zoiper_call_events(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_zoiper_call_events_extension
  ON public.zoiper_call_events(agent_extension);
