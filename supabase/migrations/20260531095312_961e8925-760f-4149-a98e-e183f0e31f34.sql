
-- 1. Teams
CREATE TABLE IF NOT EXISTS public.lead_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#ef4444',
  emoji text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_teams TO authenticated;
GRANT ALL ON public.lead_teams TO service_role;
ALTER TABLE public.lead_teams ENABLE ROW LEVEL SECURITY;

-- 2. Team membership (which agents are in which team)
CREATE TABLE IF NOT EXISTS public.lead_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.lead_teams(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL,
  role_in_team text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, admin_user_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_team_members_team ON public.lead_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_lead_team_members_admin ON public.lead_team_members(admin_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_team_members TO authenticated;
GRANT ALL ON public.lead_team_members TO service_role;
ALTER TABLE public.lead_team_members ENABLE ROW LEVEL SECURITY;

-- 3. Per-team allow/block rules for each lead source, with optional performance threshold
CREATE TABLE IF NOT EXISTS public.lead_team_source_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.lead_teams(id) ON DELETE CASCADE,
  source text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  conversion_threshold_pct numeric(5,2),
  priority integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, source)
);
CREATE INDEX IF NOT EXISTS idx_lead_team_source_rules_team ON public.lead_team_source_rules(team_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_team_source_rules TO authenticated;
GRANT ALL ON public.lead_team_source_rules TO service_role;
ALTER TABLE public.lead_team_source_rules ENABLE ROW LEVEL SECURITY;

-- Helper: who can manage (super_admin, admin, performance_manager)
CREATE OR REPLACE FUNCTION public.can_manage_lead_routing(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id
      AND role IN ('super_admin','admin','performance_manager')
  );
$$;

-- Policies: read for any authenticated admin; write only for managers
CREATE POLICY "lead_teams_read_all_admin"
  ON public.lead_teams FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "lead_teams_manage"
  ON public.lead_teams FOR ALL
  TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()))
  WITH CHECK (public.can_manage_lead_routing(auth.uid()));

CREATE POLICY "lead_team_members_read_all_admin"
  ON public.lead_team_members FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "lead_team_members_manage"
  ON public.lead_team_members FOR ALL
  TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()))
  WITH CHECK (public.can_manage_lead_routing(auth.uid()));

CREATE POLICY "lead_team_source_rules_read_all_admin"
  ON public.lead_team_source_rules FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

CREATE POLICY "lead_team_source_rules_manage"
  ON public.lead_team_source_rules FOR ALL
  TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()))
  WITH CHECK (public.can_manage_lead_routing(auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_teams_updated_at ON public.lead_teams;
CREATE TRIGGER trg_lead_teams_updated_at BEFORE UPDATE ON public.lead_teams
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_lead_team_source_rules_updated_at ON public.lead_team_source_rules;
CREATE TRIGGER trg_lead_team_source_rules_updated_at BEFORE UPDATE ON public.lead_team_source_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed three starter teams (idempotent)
INSERT INTO public.lead_teams (name, color, emoji, sort_order)
VALUES
  ('Formula Red',   '#ef4444', '🔴', 1),
  ('Formula Blue',  '#3b82f6', '🔵', 2),
  ('Formula Green', '#22c55e', '🟢', 3)
ON CONFLICT (name) DO NOTHING;
