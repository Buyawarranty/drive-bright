## Goal
The `daily_cap` on `agent_distribution_caps` should be a hard ceiling for every route that puts a lead on an agent today — not just the round-robin trigger. Today only the round-robin path checks the cap; manual reassigns, bulk reassigns, and pre-assigned (repeat-customer / Google-ad re-route) inserts all bypass it.

## Routes audited

| Route | Counter today | Cap respected today |
|---|---|---|
| Auto round-robin (`pick_agent_for_distribution`) | yes | yes |
| Insert with `assigned_to` pre-set (repeat customer, Google-ad reattach, abandoned-cart conversion) | no | no |
| Manual `assign_lead_to_agent` (one-click + drawer) | only when unassigned → agent | no |
| Bulk reassign dialog (offboarding, transfers) | same as above | no |

## Changes

### 1. New helper `enforce_agent_cap(p_agent_id uuid, p_allow_override boolean)`
- Returns `jsonb { ok, reason, current, cap }`.
- `ok = false` when `assigned_today >= daily_cap` and override not granted.
- Used by every assignment path so logic stays in one place.

### 2. `assign_lead_to_agent` (SECURITY DEFINER)
- New param `p_override_cap boolean DEFAULT false`.
- Override only honoured for `super_admin`, `admin`, `sales_manager`, `performance_manager`.
- Before mutating: call `enforce_agent_cap`. If blocked, return `{ success: false, error: 'cap_reached', cap, current }`.
- After successful write, **always** increment receiver's `assigned_today` (today it only bumps when `old_agent IS NULL`). Reassign from agent A → B now bumps B.
- Don't decrement A — daily cap reflects "leads handed out today", not live workload, matching how round-robin already behaves.

### 3. `auto_assign_lead_round_robin` trigger
- Currently returns early when `NEW.assigned_to IS NOT NULL`. Change to:
  - If pre-assigned agent is under cap → keep it, bump counter.
  - If pre-assigned agent is at/over cap → null `assigned_to` and fall through to normal distribution (so a Google-ad re-attach to a maxed-out agent reroutes instead of silently breaching the cap). Logged in `lead_assignment_audit` with `assignment_type='cap_reroute'`.
- This closes the repeat-customer leak (the main source of the 24-vs-20 gap).

### 4. Bulk reassign RPC (`BulkReassignDialog` uses `assign_lead_to_agent` per row)
- Already routed through the function, so it inherits the cap check automatically.
- Add a "Override cap (managers only)" toggle in the dialog. When ticked, pass `p_override_cap=true` on each call. Toggle disabled and hidden for sales / sales_lead roles.

### 5. Frontend toasts
- `assignLead` helper in `src/hooks/useLeads.tsx` and `BulkReassignDialog` show a red toast: *"Andy is at his daily cap (20/20). Ask a manager to override."* when `error === 'cap_reached'`.
- Managers see *"Override cap"* checkbox in the assign dropdown (single-row) and in the bulk dialog.

### 6. Audit
- Every cap-related rejection/override writes a row to `lead_assignment_audit` with `assignment_type` in `('cap_blocked','cap_override','cap_reroute')` so we can see leakage later.

## Files touched

- Migration: alters `assign_lead_to_agent`, replaces `auto_assign_lead_round_robin`, adds `enforce_agent_cap`.
- `src/hooks/useLeads.tsx` — pass override flag, handle `cap_reached`.
- `src/components/admin/leads/BulkReassignDialog.tsx` — override toggle for managers, error handling.
- `src/components/admin/leads/LeadAssignControl.tsx` (single-row assigner) — same.

## Non-goals
- No change to cap value, schedule resets, or `is_agent_on_duty` logic.
- No change to who can edit caps on the Allocation page.
- Lost / fake_lead leads still skip the cap (they're cleanup, not workload).
