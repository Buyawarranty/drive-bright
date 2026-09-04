---
name: Open Round Robin Sandbox page
description: Management-only copy of New Leads showing real live leads allocated by Open Round Robin, read-only, shadow table orr_sandbox_allocations
type: feature
---
Tab `orr-sandbox` ("Open Round Robin Sandbox") renders `OrrSandboxTabView`: a practice pass panel plus the real `NewLeadsTab` with `sandboxMode`.

Hard rules:
- Read-only against live data. `NewLeadsTab` replaces every mutating handler (status, assign, auto-assign, priority, follow-up, tags, notes, contacted, activity, delete, call count, cart migration) with a toast no-op when `sandboxMode` is true. Never let a sandbox action write to `sales_leads` or agent counters.
- Simulated ownership lives only in `public.orr_sandbox_allocations` (unique on lead_id, RLS via `public.is_management(auth.uid())`).
- Candidate agents, caps and on/off come from the SAME live settings on Lead Allocation (`agent_distribution_caps`), so going live needs no re-entry. Fair-fill rotation via `src/lib/fairFillShares.ts`.
- Management only (`admin`, `super_admin`, `sales_manager`) — it sits in `LEAD_ALLOCATION_TABS`, so sales and sales_lead are blocked, and in `BACKUP_BLOCKED_TABS`.
- `OrrSection` on the Lead Allocation page (setup, go-live switch, practice panels) stays unchanged; the sandbox is additional.
