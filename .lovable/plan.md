## Goal

Two related changes:

1. **Lead Allocation page** — let `sales_lead` (James) manage his own team's day-to-day allocation, while keeping master controls (team membership, overflow rotation, headcount, advanced source rules) restricted to `admin` / `super_admin` / `sales_manager`.
2. **Team filter chips** — sales agents and sales_leads should only ever see their own team chip (no All / other team / No team), matching the lock already in place on the Leads page.

---

## 1. Lead Allocation page (`src/components/admin/LeadTeamsTab.tsx` + `AllocationMatrix.tsx`)

### Access

- Remove the current management-only gate. Allow `sales_lead` to open the page.
- Pass an `isTeamScoped` flag to `AllocationMatrix` when the viewer is a `sales_lead`. Page header swaps to "My Team Allocation" and the subtitle reflects their team only.

### What `sales_lead` can do (own team only)

In `AllocationMatrix`, when `isTeamScoped` is true:
- Filter the agent list to members of the viewer's team (resolved via `useAgentTeams` + current admin id).
- Allow: toggle Receive Leads, edit Lead Share %, edit Daily Cap, toggle New/Recontact/Renewals workstreams, use "Split Leads Equally" (scoped to their team only).
- Hide the team-picker column / "Change team" action on each row (membership stays a master control).

### What stays master-only (admin / super_admin / sales_manager)

Split the page into two visual sections inside `LeadTeamsTab`:

```text
┌─ Team Allocation (visible to sales_lead + management) ─┐
│   AllocationMatrix (scoped for sales_lead)             │
└─────────────────────────────────────────────────────────┘
┌─ Master Controls (management only, hidden for sales_lead)┐
│   • Team membership / move agent between teams           │
│   • Overflow Recipients order (#1, #2, #3)               │
│   • Advanced Source Rules (existing LeadRoutingPanel)    │
└──────────────────────────────────────────────────────────┘
```

The existing "Advanced Source Rules" collapsible stays exactly as it is but is rendered only when `effectiveRole` is management. Overflow recipient ordering UI (currently inside `AllocationMatrix`) gets gated behind the same management check — read-only for `sales_lead` is out of scope; it's simply hidden.

### Sidebar entry

`SidebarTeamSwitcher` already hides for non-management. The Lead Allocation menu link needs to also show for `sales_lead`. Find the sidebar nav definition and add `sales_lead` to the allowed roles for that single link.

---

## 2. Team filter chips — lock sales / sales_lead to own team

Currently `NewLeadsTab.tsx` (line ~1058) already renders a locked single-chip variant for `sales` / `sales_lead` with `myTeam`. Good. But:

- `SidebarTeamSwitcher` already excludes those roles — keep as-is.
- `TeamFilterChips` itself is used inside that conditional block; no change needed to the component, only confirm sales_lead never reaches the multi-chip branch. The current logic at line 1085 falls back to a "no team assigned" pill if `myTeam` is empty — keep that.

No code change is required for #2 beyond confirming the existing branches. Will verify by reading lines 1057–1100 and adjust only if `sales_lead` can reach the full chip row.

---

## Files to edit

- `src/components/admin/LeadTeamsTab.tsx` — relax gate, split into Team / Master sections.
- `src/components/admin/leads/AllocationMatrix.tsx` — accept `isTeamScoped` prop, filter agent rows, hide team-change + overflow controls when scoped.
- Sidebar nav file (the one that lists admin tabs) — add `sales_lead` to the Lead Allocation link visibility.
- `src/components/admin/leads/NewLeadsTab.tsx` — verify chip lock for sales_lead (likely no change).

No DB / RLS changes — all the underlying tables already allow `sales_lead` writes scoped via existing policies; the gating here is UI-only. If a write fails at runtime we'll revisit with a migration.

---

## Answer to the chip question

**Sales agents and sales_leads should only see their own team chip** — no All, no other teams, no "No team". This is already how the Leads page is wired; we'll extend the same lock everywhere a team chip row appears (Lead Allocation page header, any scoreboard, etc.).
