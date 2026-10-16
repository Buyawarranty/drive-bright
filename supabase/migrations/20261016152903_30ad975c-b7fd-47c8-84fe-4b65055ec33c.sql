-- ============ ORR LIVE + OVERNIGHT ALLOCATION — PHASE 1 DATA MODEL ============

-- Enums
DO $$ BEGIN
  CREATE TYPE public.distribution_method AS ENUM ('ROUND_ROBIN', 'OPEN_ROUND_ROBIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.distribution_environment AS ENUM ('SANDBOX', 'LIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.lead_entry_type AS ENUM ('LIVE', 'OVERNIGHT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.orr_availability_state AS ENUM ('READY', 'WORKING_ORR', 'FOCUS_CURRENT_LEADS', 'UNAVAILABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 1: team distribution model (existing teams stay ROUND_ROBIN / LIVE)
ALTER TABLE public.lead_teams
  ADD COLUMN IF NOT EXISTS distribution_method public.distribution_method NOT NULL DEFAULT 'ROUND_ROBIN',
  ADD COLUMN IF NOT EXISTS distribution_environment public.distribution_environment NOT NULL DEFAULT 'LIVE';

-- Step 3/4/7/14/17: lead-level ORR fields (originals never rewritten)
ALTER TABLE public.sales_leads
  ADD COLUMN IF NOT EXISTS original_distribution_method public.distribution_method,
  ADD COLUMN IF NOT EXISTS distribution_team_id uuid REFERENCES public.lead_teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS distribution_environment public.distribution_environment,
  ADD COLUMN IF NOT EXISTS lead_entry_type public.lead_entry_type,
  ADD COLUMN IF NOT EXISTS original_lead_datetime timestamptz,
  ADD COLUMN IF NOT EXISTS customer_browse_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_eligible_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_reserved_agent_id uuid,
  ADD COLUMN IF NOT EXISTS orr_reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS orr_reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS contacted_agent_id uuid,
  ADD COLUMN IF NOT EXISTS orr_contact_day integer NOT NULL DEFAULT 1;

-- Step 10/13: agent ORR availability + fair rotation
CREATE TABLE IF NOT EXISTS public.orr_agent_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  state public.orr_availability_state NOT NULL DEFAULT 'UNAVAILABLE',
  last_orr_allocation_at timestamptz,
  orr_rotation_position integer,
  ready_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orr_agent_availability TO authenticated;
GRANT ALL ON public.orr_agent_availability TO service_role;
ALTER TABLE public.orr_agent_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents manage their own ORR availability"
  ON public.orr_agent_availability FOR ALL TO authenticated
  USING (admin_user_id = public.current_admin_user_id())
  WITH CHECK (admin_user_id = public.current_admin_user_id());

CREATE POLICY "Management can view all ORR availability"
  ON public.orr_agent_availability FOR SELECT TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()));

CREATE POLICY "Management can update all ORR availability"
  ON public.orr_agent_availability FOR ALL TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()))
  WITH CHECK (public.can_manage_lead_routing(auth.uid()));

-- Step 16/18/20-23: ORR attempt history
CREATE TABLE IF NOT EXISTS public.orr_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  attempt_agent_id uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  attempt_day integer NOT NULL DEFAULT 1,
  call_started_at timestamptz,
  outcome text, -- 'contacted' | 'customer_unavailable' | 'reservation_lapsed'
  contact_success boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orr_attempts TO authenticated;
GRANT ALL ON public.orr_attempts TO service_role;
ALTER TABLE public.orr_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents record and view their own ORR attempts"
  ON public.orr_attempts FOR ALL TO authenticated
  USING (attempt_agent_id = public.current_admin_user_id())
  WITH CHECK (attempt_agent_id = public.current_admin_user_id());

CREATE POLICY "Management can view all ORR attempts"
  ON public.orr_attempts FOR SELECT TO authenticated
  USING (public.can_manage_lead_routing(auth.uid()));

-- Step 21/22/28: configurable retry + overnight protection settings
ALTER TABLE public.orr_config
  ADD COLUMN IF NOT EXISTS weekday_attempts_per_day integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS weekend_attempts_per_day integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_retry_gap_hours integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS overnight_max_wait_minutes integer,
  ADD COLUMN IF NOT EXISTS contact_journey_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS browse_window_seconds integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS reservation_seconds integer NOT NULL DEFAULT 120;

-- updated_at trigger for availability
CREATE OR REPLACE FUNCTION public.orr_agent_availability_touch()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS orr_agent_availability_touch ON public.orr_agent_availability;
CREATE TRIGGER orr_agent_availability_touch
  BEFORE UPDATE ON public.orr_agent_availability
  FOR EACH ROW EXECUTE FUNCTION public.orr_agent_availability_touch();