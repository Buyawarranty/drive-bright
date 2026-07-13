alter table public.lead_team_members
  add column if not exists can_see_team_leads boolean not null default false;

comment on column public.lead_team_members.can_see_team_leads is
  'When true, agent sees all teammates leads in their sales agent leads view. When false, only their own.';