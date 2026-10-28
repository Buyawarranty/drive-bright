CREATE TABLE public.lead_access_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES public.admin_users(id),
 action text NOT NULL CHECK (action IN ('lead_open','phone_copy')),
 source text NOT NULL CHECK (source ~ '^[a-z0-9_]{1,48}$'),
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_access_events_lead_time_idx ON public.lead_access_events(lead_id, occurred_at DESC);
CREATE INDEX lead_access_events_actor_time_idx ON public.lead_access_events(actor_id, occurred_at DESC);
GRANT SELECT, INSERT ON public.lead_access_events TO authenticated;
GRANT ALL ON public.lead_access_events TO service_role;
ALTER TABLE public.lead_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins review lead access history" ON public.lead_access_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=auth.uid() AND au.is_active AND au.archived_at IS NULL AND au.role::text IN ('admin','super_admin')));
CREATE POLICY "Staff record own permitted lead access" ON public.lead_access_events FOR INSERT TO authenticated
WITH CHECK (actor_id=public.current_admin_user_id() AND EXISTS (SELECT 1 FROM public.sales_leads sl WHERE sl.id=lead_id));
CREATE OR REPLACE FUNCTION public.stamp_lead_access_event() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.actor_id := public.current_admin_user_id(); NEW.occurred_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER stamp_lead_access_event BEFORE INSERT ON public.lead_access_events FOR EACH ROW EXECUTE FUNCTION public.stamp_lead_access_event();