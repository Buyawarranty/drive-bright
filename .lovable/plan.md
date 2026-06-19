## Goal
Collapse the 3-layer routing (Source % → Team % → Agent) into a single-layer round-robin, and merge "Master Allocation", "By Team", and "Live Leads" into one Leads page with filter chips. Keep all existing APIs, edge functions, and DB writes intact — only the UI and the *picker* logic change.

## Non-negotiables (no functionality breakage)
- Do NOT delete tables, columns, edge functions, or RPCs. Everything stays so any in-flight cron/webhook keeps working.
- Do NOT change `sales_leads`, `lead_team_members`, `lead_team_source_rules`, `agent_distribution_caps` schemas.
- Do NOT touch lead capture, abandoned cart, Stripe, Google Ads, ClickSend, or any integration code.
- The current routing edge function keeps running unchanged. We just stop *requiring* the source matrix and start honouring a simpler weight.

## What changes (UI only, phase 1)

### 1. New simplified Master Allocation page
Replace the current page body with one table:

```
Agent              Team tag   Receiving?   Share %   Workstreams
─────────────────  ─────────  ───────────  ────────  ──────────────────
James Smith        [Red ▾]    [ON ]        [ 25 ]    [New][Recontact][Renewals]
Kevin Jones        [Blue ▾]   [ON ]        [ 15 ]    [New]
Thomas Brown       [Red ▾]    [OFF]        [  0 ]    [New]
...
                                           ─────
                                           Total: 100% ✓
```

- Team column is just a colour tag (dropdown, used for filtering & reporting only).
- "Receiving?" toggle = the only routing on/off.
- Share % = single weight used by the round-robin.
- Workstream chips reuse existing `workstream_new_leads / recontact / renewals` columns.
- Row total badge: green at 100, amber otherwise (informational — does not block save).

### 2. Source Routing — demoted, not deleted
Move the matrix behind an "Advanced: source overrides" collapsible at the bottom, default closed, with a banner:
> "Most teams don't need this. Leave empty and leads round-robin across all receiving agents."

The existing `SourceRulesMatrix` component stays as-is inside the collapsible. No code removed.

### 3. Unified Leads page (filter chips)
Add a single chip bar above the existing leads table:

`[ All ] [ My leads ] [ 🔴 Red ] [ 🔵 Blue ] [ 🟢 Green ] [ Unassigned ] | [ New ] [ Recontact ] [ Renewals ] | [ Callbacks ] [ Reminders due ]`

- Chips drive existing filter state in `NewLeadsTab`. No new data fetch logic.
- The separate "By Team" view button collapses into the team chips.
- "Leads" heading already resets filters (kept from last change).

## What changes (logic, phase 2 — minimal)

The current routing edge function already supports team % rules. We add a single safe fallback:

> If no `lead_team_source_rules` row matches the incoming source (or all rules sum to 0), pick the next agent by weighted round-robin across `lead_team_members` where the member is on the relevant workstream AND `agent_distribution_caps.percentage > 0`, ignoring team entirely.

This is purely additive — existing source rules still win when present. If the third-party APIs are currently down, this changes nothing about external calls.

## Files touched

UI only:
- `src/components/admin/LeadTeamsTab.tsx` — restructure to single table + collapsible advanced section.
- `src/components/admin/leads/AllocationMatrix.tsx` — add Team tag dropdown column, Receiving toggle, Share % input. Keep all existing handlers.
- `src/components/admin/leads/NewLeadsTab.tsx` — add chip bar; remove the separate "By Team" view button (component stays on disk).
- Keep `TeamsOverview.tsx`, `SourceRulesMatrix.tsx`, `LeadRoutingDialog.tsx` files in place — referenced from the advanced section / unused but not deleted.

Edge function (phase 2, optional — flagged for separate approval):
- `supabase/functions/<assign-lead>/index.ts` — add fallback branch only. No schema change, no new secrets.

## What is explicitly NOT in this change
- No table drops, no column drops, no RLS changes, no migration.
- No edits to lead capture, Stripe, email, SMS, claims, or any integration.
- No change to permissions/roles.
- No change to the customer-facing site.

## Rollback
Every change is in 3 component files. Reverting those files restores today's UI. The edge function fallback (phase 2) is an `if (noRulesMatched)` branch — remove the branch to revert.

## Proposed order
1. Phase 1 UI consolidation (this approval).
2. Use it for a few days. If the source matrix really is unused, in a later session we add the edge-function fallback and hide the matrix entirely.
