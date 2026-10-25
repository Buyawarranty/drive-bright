ALTER TABLE public.lead_team_members
  ADD COLUMN IF NOT EXISTS can_see_all_agent_data boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lead_team_members.can_see_all_agent_data IS 'When true, this agent may see other sales agents'' names/data (e.g. deal owner in Customer Management). Default false: agents only see their own name on their own deals.';