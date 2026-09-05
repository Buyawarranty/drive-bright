---
name: ORR sandbox and New Leads follow Lead Allocation settings
description: Open Round Robin settings have one source (lead_distribution_settings/lead_teams/lead_team_members) read via useOrrLiveSettings; sandbox and New Leads must never hold their own copy
type: constraint
---
- All Open Round Robin setup (which teams, live on/off, membership, caps, Flow split) is owned by the Lead Allocation page. Every other surface — ORR Sandbox tab, New Leads — must READ those same rows, never keep a separate copy or a local default.
- Read them through `src/hooks/useOrrLiveSettings.ts` (React Query key `['orr-live-settings']` + realtime on `lead_distribution_settings`, `lead_teams`, `lead_team_members`) so a change on Lead Allocation appears everywhere without a reload.
- Local state is allowed only as a short-lived optimistic override that clears when the shared query updates.
**Why:** when ORR is switched live, every adjustment already made on Lead Allocation must apply as-is — no migration, no divergence between sandbox and live.
