---
name: Sales roles never see lead source
description: Lead source must be hidden from sales, sales_lead and sales_manager everywhere in New Leads, including the new-lead pop-up cards and all team views (Blue/Red)
type: constraint
---
- `NewLeadsTab.tsx`: `sourceVisible` is forced false for `sales`, `sales_lead`, `sales_manager` — a granular `new-leads:see-source` permission cannot override it.
- `NewLeadAlerts.tsx` pop-up detail rows must never include a Source row (agent-facing surface).
- Source stays visible only to super_admin, admin and lead_gen (super admin keeps the local H hide toggle).
**Why:** sales agents were seeing where leads came from in the New Leads pop-ups.
