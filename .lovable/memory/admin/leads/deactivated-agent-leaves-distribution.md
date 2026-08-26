---
name: Deactivated agents leave lead distribution
description: Switching a staff member to Inactive/archived must pause their distribution cap, clear all workstreams, and hide them from New Leads and Allocation lists
type: constraint
---
- DB trigger `trg_deactivated_agent_leaves_distribution` on `admin_users`: when `is_active` goes false or `archived_at` is set, `agent_distribution_caps.paused = true` and all three `lead_team_members.workstream_*` flags go false.
- All agent lists (distribution caps, allocation, New Leads filters) must exclude `is_active = false` or `archived_at IS NOT NULL` staff.
- New cap rows insert `paused = true` (agents start switched OFF).
**Why:** Greg Phillips was set Inactive but still appeared in New Leads and Allocate Leads and was flagged to receive new leads.
