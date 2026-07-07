
CREATE OR REPLACE FUNCTION public.shark_tank_is_management()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role::text IN ('admin','super_admin','sales_manager')
  );
$$;

CREATE TABLE IF NOT EXISTS public.shark_tank_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  team_ids UUID[] NOT NULL DEFAULT '{}',
  hold_seconds INT NOT NULL DEFAULT 60,
  retry_minutes INT NOT NULL DEFAULT 15,
  chase_minutes INT NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.shark_tank_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.shark_tank_settings TO authenticated;
GRANT ALL ON public.shark_tank_settings TO service_role;
ALTER TABLE public.shark_tank_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone reads shark_tank_settings" ON public.shark_tank_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Management writes shark_tank_settings" ON public.shark_tank_settings FOR ALL TO authenticated
  USING (public.shark_tank_is_management()) WITH CHECK (public.shark_tank_is_management());

DO $$ BEGIN
  CREATE TYPE public.shark_tank_status AS ENUM ('queued','held','retry_hold','chase_hold','claimed','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.shark_tank_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL UNIQUE REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.lead_teams(id) ON DELETE SET NULL,
  status public.shark_tank_status NOT NULL DEFAULT 'queued',
  held_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  held_until TIMESTAMPTZ,
  retry_until TIMESTAMPTZ,
  chase_release_at TIMESTAMPTZ,
  attempt_count INT NOT NULL DEFAULT 0,
  last_outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shark_tank_pool TO authenticated;
GRANT ALL ON public.shark_tank_pool TO service_role;
ALTER TABLE public.shark_tank_pool ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Management manages shark_tank_pool" ON public.shark_tank_pool FOR ALL TO authenticated
  USING (public.shark_tank_is_management()) WITH CHECK (public.shark_tank_is_management());
CREATE POLICY "Agents read shark_tank_pool" ON public.shark_tank_pool FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_shark_tank_pool_status_team ON public.shark_tank_pool(status, team_id);

CREATE TABLE IF NOT EXISTS public.shark_tank_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.shark_tank_audit TO authenticated;
GRANT ALL ON public.shark_tank_audit TO service_role;
ALTER TABLE public.shark_tank_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Management reads shark_tank_audit" ON public.shark_tank_audit FOR SELECT TO authenticated
  USING (public.shark_tank_is_management());
CREATE POLICY "System inserts shark_tank_audit" ON public.shark_tank_audit FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_shark_tank_audit_lead ON public.shark_tank_audit(lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.shark_tank_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_shark_tank_pool_touch ON public.shark_tank_pool;
CREATE TRIGGER trg_shark_tank_pool_touch BEFORE UPDATE ON public.shark_tank_pool
  FOR EACH ROW EXECUTE FUNCTION public.shark_tank_touch_updated_at();

DROP TRIGGER IF EXISTS trg_shark_tank_settings_touch ON public.shark_tank_settings;
CREATE TRIGGER trg_shark_tank_settings_touch BEFORE UPDATE ON public.shark_tank_settings
  FOR EACH ROW EXECUTE FUNCTION public.shark_tank_touch_updated_at();

CREATE OR REPLACE FUNCTION public.shark_tank_is_active(_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT enabled AND _team_id IS NOT NULL AND _team_id = ANY(team_ids)
  FROM public.shark_tank_settings WHERE id=1;
$$;

CREATE OR REPLACE FUNCTION public.shark_tank_take_next(_team_id UUID)
RETURNS TABLE(lead_id UUID, held_until TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id UUID; v_hold_seconds INT; v_row public.shark_tank_pool%ROWTYPE;
BEGIN
  SELECT id INTO v_admin_id FROM public.admin_users WHERE user_id = auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF NOT public.shark_tank_is_active(_team_id) THEN RAISE EXCEPTION 'shark_tank_disabled_for_team'; END IF;
  IF EXISTS (SELECT 1 FROM public.shark_tank_pool WHERE held_by=v_admin_id AND status IN ('held','retry_hold')) THEN
    RAISE EXCEPTION 'existing_hold';
  END IF;
  SELECT hold_seconds INTO v_hold_seconds FROM public.shark_tank_settings WHERE id=1;
  UPDATE public.shark_tank_pool p
    SET status='held', held_by=v_admin_id,
        held_until = now() + make_interval(secs => v_hold_seconds),
        attempt_count = attempt_count + 1
    WHERE p.id = (
      SELECT id FROM public.shark_tank_pool
       WHERE team_id=_team_id AND status='queued'
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RETURN; END IF;
  INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
  VALUES (v_row.lead_id, v_admin_id, 'taken', jsonb_build_object('held_until', v_row.held_until));
  RETURN QUERY SELECT v_row.lead_id, v_row.held_until;
END $$;

CREATE OR REPLACE FUNCTION public.shark_tank_log_outcome(
  _lead_id UUID, _outcome TEXT, _next_action TEXT DEFAULT NULL, _call_reference TEXT DEFAULT NULL
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin_id UUID; v_row public.shark_tank_pool%ROWTYPE; v_retry_min INT; v_chase_min INT;
BEGIN
  SELECT id INTO v_admin_id FROM public.admin_users WHERE user_id = auth.uid();
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT * INTO v_row FROM public.shark_tank_pool WHERE lead_id=_lead_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.held_by <> v_admin_id THEN RAISE EXCEPTION 'not_lead_owner'; END IF;
  IF v_row.status NOT IN ('held','retry_hold') THEN RAISE EXCEPTION 'lead_not_held'; END IF;
  SELECT retry_minutes, chase_minutes INTO v_retry_min, v_chase_min FROM public.shark_tank_settings WHERE id=1;
  IF _outcome='answered' THEN
    IF COALESCE(_next_action,'')='' OR COALESCE(_call_reference,'')='' THEN RAISE EXCEPTION 'missing_required_fields'; END IF;
    UPDATE public.shark_tank_pool SET status='claimed', last_outcome='answered' WHERE id=v_row.id;
    INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
    VALUES (_lead_id, v_admin_id, 'claimed_owned', jsonb_build_object('next_action',_next_action,'call_reference',_call_reference));
    RETURN 'claimed';
  ELSIF _outcome='no_answer' THEN
    IF v_row.status='held' THEN
      UPDATE public.shark_tank_pool SET status='retry_hold',
        retry_until = now() + make_interval(mins => v_retry_min),
        last_outcome='no_answer' WHERE id=v_row.id;
      INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
      VALUES (_lead_id, v_admin_id, 'retry_started', jsonb_build_object('retry_minutes',v_retry_min));
      RETURN 'retry_hold';
    ELSE
      UPDATE public.shark_tank_pool SET status='chase_hold', held_by=NULL,
        chase_release_at = now() + make_interval(mins => v_chase_min),
        last_outcome='no_answer' WHERE id=v_row.id;
      INSERT INTO public.shark_tank_audit(lead_id, actor_id, action, payload)
      VALUES (_lead_id, v_admin_id, 'chase_locked', jsonb_build_object('chase_minutes',v_chase_min));
      RETURN 'chase_hold';
    END IF;
  ELSE RAISE EXCEPTION 'invalid_outcome'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.shark_tank_reap()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT := 0; v_chase INT;
BEGIN
  SELECT chase_minutes INTO v_chase FROM public.shark_tank_settings WHERE id=1;
  WITH x AS (
    UPDATE public.shark_tank_pool SET status='queued', held_by=NULL, held_until=NULL
     WHERE status='held' AND held_until < now() RETURNING lead_id
  ) INSERT INTO public.shark_tank_audit(lead_id, action, payload) SELECT lead_id, 'expired_by_worker', '{"from":"held"}'::jsonb FROM x;
  WITH x AS (
    UPDATE public.shark_tank_pool SET status='chase_hold', held_by=NULL,
      chase_release_at = now() + make_interval(mins => v_chase)
     WHERE status='retry_hold' AND retry_until < now() RETURNING lead_id
  ) INSERT INTO public.shark_tank_audit(lead_id, action, payload) SELECT lead_id, 'chase_locked', '{"from":"retry_expired"}'::jsonb FROM x;
  WITH x AS (
    UPDATE public.shark_tank_pool SET status='queued', chase_release_at=NULL
     WHERE status='chase_hold' AND chase_release_at < now() RETURNING lead_id
  ) INSERT INTO public.shark_tank_audit(lead_id, action, payload) SELECT lead_id, 'returned_to_pool', '{}'::jsonb FROM x;
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.shark_tank_enqueue_lead()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team UUID;
BEGIN
  IF NEW.status IN ('lost','converted','fake_lead') THEN RETURN NEW; END IF;
  SELECT team_id INTO v_team FROM public.lead_team_members WHERE admin_user_id = NEW.assigned_to LIMIT 1;
  IF NOT public.shark_tank_is_active(v_team) THEN RETURN NEW; END IF;
  INSERT INTO public.shark_tank_pool(lead_id, team_id, status) VALUES (NEW.id, v_team, 'queued') ON CONFLICT (lead_id) DO NOTHING;
  INSERT INTO public.shark_tank_audit(lead_id, action, payload) VALUES (NEW.id, 'queued', jsonb_build_object('team_id', v_team));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_shark_tank_enqueue ON public.sales_leads;
CREATE TRIGGER trg_shark_tank_enqueue AFTER INSERT ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.shark_tank_enqueue_lead();

ALTER PUBLICATION supabase_realtime ADD TABLE public.shark_tank_pool;
