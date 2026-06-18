---
name: Team Red live / Team Blue dormant
description: Team Red mirrors the current live lead distribution flow and must not be disturbed. Team Blue is built but receives zero leads until Sales Manager explicitly enables source rules.
type: constraint
---
- "Team Red" = the existing global lead distribution flow used by the live sales team. Do NOT change its members, settings, round-robin state, or trigger fallback behaviour.
- "Team Blue" exists in `lead_teams` but must receive NO leads automatically. Keep its `lead_team_source_rules` rows `allowed = false` (or absent) until the Sales Manager explicitly enables them in the Distribution UI.
- All entries in `lead_team_source_rules` are currently set to `allowed = false` so the routing trigger always falls back to the live global path. Do not bulk re-enable.
- When editing the LeadRoutingDialog, label "Global default" as "Team Red (live)" so the Sales Manager understands which config is in production.
**Why:** Sales team is using the leads section daily; any rule that diverts leads to Blue before it is ready will starve live agents.
