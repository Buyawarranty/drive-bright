-- Ensure Team Blue receives no leads until Sales Manager opts in.
-- Disable any existing source rules so trigger always falls back to live global flow.
UPDATE public.lead_team_source_rules SET allowed = false WHERE allowed = true;