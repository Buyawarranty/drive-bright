-- 1. Add new role for Sales Managers (must be its own migration step to use later)
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sales_manager';

-- 2. Per-team scoping columns (nullable; NULL = global default = today's behaviour)
ALTER TABLE public.lead_distribution_settings
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.lead_teams(id) ON DELETE CASCADE;

ALTER TABLE public.round_robin_state
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.lead_teams(id) ON DELETE CASCADE;

ALTER TABLE public.overflow_round_robin_state
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.lead_teams(id) ON DELETE CASCADE;

-- 3. Ensure exactly one row per team (and exactly one global row)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_distribution_settings_global
  ON public.lead_distribution_settings ((1)) WHERE team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_distribution_settings_per_team
  ON public.lead_distribution_settings (team_id) WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_round_robin_state_global
  ON public.round_robin_state ((1)) WHERE team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_round_robin_state_per_team
  ON public.round_robin_state (team_id) WHERE team_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_overflow_rr_state_global
  ON public.overflow_round_robin_state ((1)) WHERE team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_overflow_rr_state_per_team
  ON public.overflow_round_robin_state (team_id) WHERE team_id IS NOT NULL;