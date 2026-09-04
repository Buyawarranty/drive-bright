# Open Round Robin Sandbox — a safe copy of the New Leads page

## What you get

A new section in the admin sidebar, **Open Round Robin Sandbox**, visible only to managers, sales managers, admins and super admins.

It looks and behaves exactly like the New Leads page — same table, same columns, same filters, same date selector, same team chips, same search and badges — and it shows the **real leads arriving right now**. The difference is that who would pick up each lead is worked out by Open Round Robin rules instead of the current rotation, and nothing you do in there touches a real lead.

So you can sit and watch a normal working day play out under Open Round Robin, side by side with what is actually happening, before deciding to go live.

## Rules it obeys

- Read-only against real data. No lead is assigned, re-assigned, called, statused, notified or counted towards anybody's figures from this page.
- Every simulated allocation is stored separately from the live leads, so the live New Leads page and the agents' own views are completely unaffected.
- A permanent "Sandbox — not live" banner sits at the top, plus a badge on every simulated allocation.
- The real settings stay in one place: teams, daily caps, who's switched on, break/leave, and the Flow split all continue to come from the Lead Allocation page. The sandbox reads those same settings, so when you flip the go-live switch nothing has to be re-entered — the same rules simply start acting for real.
- Managers only. Sales and sales leads never see the tab.

## How it works (technical)

**New tab**
- Add tab key `orr-sandbox` to the admin sidebar + `AdminDashboard.tsx` `renderContent()`, gated by the same management check used elsewhere (`admin`, `super_admin`, `sales_manager`), otherwise `AccessDenied`.

**Reuse, do not fork, the New Leads page**
- Add an optional `sandboxMode?: boolean` prop to `NewLeadsTab`, defaulting to `false`, so the live page is byte-for-byte unchanged in behaviour.
- Thread `sandboxMode` down through a small React context (`OrrSandboxContext`) so `LeadsTable`, `LeadTableRow`, the action menus, `OpenLeadPoolBar` and the dialogs can read it without prop-drilling through ~2,400 lines.
- In sandbox mode: every mutating handler (status change, assign, reassign, notes, reminders, call logging, exports of real data, mark converted/fake) becomes a no-op that shows a toast "Sandbox — nothing was changed". Reads (`useLeads`, filters, counts) are untouched.

**Shadow allocation layer**
- New table `orr_sandbox_allocations` (lead_id, simulated_agent_id, simulated_at, reason, run_id, created_by) with GRANTs and RLS restricted to management, holding only the simulation. Nothing writes to `sales_leads`.
- New hook `useOrrSandboxAllocations` joins those rows onto the live leads by id, so the Assigned-to column shows the simulated agent with a sandbox badge, falling back to "would go to …" where no simulation exists yet.
- A "Run Open Round Robin now" button re-computes the simulation for the leads currently in view using the existing candidate rules (team membership, caps, on/off, workstreams, sticky ownership) read from `lead_distribution_settings` / `agent_distribution_caps`, plus the ORR first-call windows already configured. Implemented as a new function `orr_sandbox_simulate` that only ever writes to `orr_sandbox_allocations`.

**Left as is**
- `OrrSection` on the Lead Allocation page (setup, go-live switch, practice panels) stays exactly where it is; this is additional, not a replacement.

## Check before finishing

- Live New Leads page behaves identically for a sales agent and for a manager.
- Sandbox page shows the same lead count as New Leads for the same filters.
- Attempting any action in the sandbox leaves the database row untouched.
