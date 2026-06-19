
ALTER TABLE public.lead_team_members
  ADD COLUMN IF NOT EXISTS workstream_new_leads boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS workstream_recontact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS workstream_renewals  boolean NOT NULL DEFAULT false;
