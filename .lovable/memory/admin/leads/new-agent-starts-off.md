---
name: New agents start switched OFF
description: A newly added agent must never receive leads until a manager explicitly switches on a lead type; team membership defaults to all workstreams false
type: constraint
---
- When an agent is added to a lead team (Allocation matrix or User Permissions), `lead_team_members.workstream_new_leads/recontact/renewals` must all insert as `false`, and `agent_distribution_caps.paused` stays `true`.
- Read the flags strictly (`=== true`). Never treat a missing/false workstream flag as enabled (`!== false` is wrong).
**Why:** Manager added Greg and he immediately showed as taking new leads without being turned on.
