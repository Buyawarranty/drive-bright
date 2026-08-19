CREATE TABLE public.admin_ui_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid,
  admin_email text,
  event_type text not null,
  tab text,
  path text,
  label text,
  detail jsonb,
  session_id text,
  duration_ms integer,
  user_agent text
);

GRANT SELECT, INSERT ON public.admin_ui_events TO authenticated;
GRANT ALL ON public.admin_ui_events TO service_role;

ALTER TABLE public.admin_ui_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can log their own admin UI events"
ON public.admin_ui_events FOR INSERT TO authenticated
WITH CHECK (public.is_active_admin_user(auth.uid()));

CREATE POLICY "Staff can view their own admin UI events"
ON public.admin_ui_events FOR SELECT TO authenticated
USING (admin_user_id = public.current_admin_user_id() OR public.is_admin(auth.uid()));

CREATE INDEX idx_admin_ui_events_created_at ON public.admin_ui_events (created_at desc);
CREATE INDEX idx_admin_ui_events_admin_created ON public.admin_ui_events (admin_user_id, created_at desc);
CREATE INDEX idx_admin_ui_events_type_created ON public.admin_ui_events (event_type, created_at desc);