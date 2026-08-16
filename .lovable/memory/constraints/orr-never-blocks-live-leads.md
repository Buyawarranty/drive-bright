---
name: ORR never blocks live leads
description: Open Round Robin intake parking (overnight/weekend hold) only applies when open_round_robin_enabled is true; otherwise every lead stays live
type: constraint
---
Open Round Robin must never stop live new leads from reaching agents.

- `sales_leads_classify_intake` only parks a lead as `intake_class = 'overnight'` when `open_round_robin_enabled` is true for Team Blue (or globally) in `lead_distribution_settings`. When ORR is off, leads are stamped `live` with `eligible_at = created_at` so normal round robin assigns them immediately.
- Evening, weekend and out-of-hours arrivals must still be workable by agents who are on shift. Never gate the New Leads table, calling or status updates behind ORR windows or reservations.

**Why:** an ORR out-of-hours hold parked incoming enquiries so agents working that evening could not work them.
