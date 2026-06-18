# Per-Team Lead Routing — Safe, Additive Build

## Safety guarantee (what stays untouched)
Everything sales agents use today keeps working identically:
- Their leads list, filters, search, callbacks, claim/assign buttons — no changes.
- The global round-robin / percentage / solo distribution keeps running exactly as it does today.
- If no team rules exist for a lead's source, the trigger falls through to the **current** global logic. Day 1 after deploy = zero behavioural change, because no source is locked to a team yet until the Sales Manager opts in.
- New UI is gated to `sales_manager`, `admin`, `super_admin` only. Sales/sales_lead roles see no new buttons.

## What gets built

### 1. New role: `sales_manager`
- Add `sales_manager` to the allowed admin role set.
- Permission key: `tab_lead_routing` (visible to super_admin/admin by default, grantable to sales_manager via UserPermissionsTab). Sales agents never see it.
- The existing "Lead Routing & Teams" dialog gets opened from a new button visible only to those three roles. The button currently shown to sales_lead/admin in the leads toolbar stays as-is for admins; for sales_lead it's hidden (matches the earlier "hide team from sales_lead" change).

### 2. Schema (additive only — no column drops, no defaults that change current rows)
- `lead_distribution_settings` → add nullable `team_id uuid`. Existing single row stays `team_id = NULL` = the global default. New rows can be created per team.
- `round_robin_state` → add nullable `team_id uuid`. Existing row stays `team_id = NULL` for the global cycle. Per-team rows added on demand.
- `overflow_round_robin_state` → same pattern (nullable `team_id`).
- Unique indexes: `(team_id)` partial unique on each settings/state table so there's exactly one row per team and one global row.
- `lead_teams.is_active` already exists; we honour it.

### 3. Trigger change (`auto_assign_lead_round_robin`)
Wrap the existing body in a "try team first, else fall through" shell:
1. Look up `lead_team_source_rules` where `source = NEW.lead_source` AND `allowed = true` AND team `is_active`, ordered by `priority`.
2. For each matching team in priority order: try to assign using that team's settings row (or the global settings if the team has no override) restricted to `lead_team_members` of that team, applying the same solo/percentage/round-robin rules with the team's own `round_robin_state` row.
3. If a team assignment succeeds → done. If no team matches or no team member is eligible → **call the existing global logic unchanged**.

Result: current global flow is the fallback, so the trigger behaves identically until a Sales Manager configures a team rule.

### 4. UI (LeadRoutingDialog rework — same dialog, additive)
- Add a team picker chip row at the top: "Editing: [Global default ▾] [Red] [Blue] [+ New team]". Default selection = Global (today's behaviour).
- All existing controls (distribution mode, round-robin order, percentages, solo mode, overflow recipients, source rules, members) are rebound to write to the selected team's row (or the global row when "Global default" is selected).
- For Global, the dialog reads/writes the exact same rows it does today → existing admins editing global settings see no functional change.
- Per-team source rules editor on the same tab so the Manager can tick "Red Team receives Facebook leads".

### 5. Permissions / access
- `can_manage_lead_routing()` SQL function extended to also return true for `sales_manager`.
- RLS on `lead_distribution_settings`, `round_robin_state`, `lead_teams`, `lead_team_members`, `lead_team_source_rules` updated to allow `sales_manager` the same management rights admins already have. No new access for sales agents.

## Rollout plan (zero-disruption)
1. Migration 1: add nullable columns + indexes + role/permission. Trigger unchanged. → Deploy. Verified: live distribution unchanged.
2. Migration 2: replace trigger with the "try team first → fallback to existing global block" version. The global block is a verbatim copy of today's logic. → Deploy. Verified: with no source rules set, every lead still flows through the global path.
3. UI ships gated to the three roles. Sales agents see nothing new.
4. Sales Manager turns on Red/Blue source routing when ready. Until they do, behaviour = today.

## Files to touch
- `supabase/migrations/...` (two migrations as above)
- `src/components/admin/leads/LeadRoutingDialog.tsx` (team picker + per-team binding)
- `src/components/admin/UserPermissionsTab.tsx` + `src/lib/permissions/types.ts` (new `tab_lead_routing` permission, `sales_manager` role)
- `src/pages/AdminDashboard.tsx` + `src/components/admin/AdminSidebar.tsx` (recognise `sales_manager`)
- `src/components/admin/leads/NewLeadsTab.tsx` (show "Lead Routing & Teams" button to `sales_manager` too)

## Technical notes
- Trigger rewrite uses `SECURITY DEFINER` (unchanged). Per-team `round_robin_state` rows created lazily inside the trigger via `INSERT … ON CONFLICT DO NOTHING`.
- All new columns nullable, no `NOT NULL` backfills → safe on a live table.
- No data migration of existing settings; the current row becomes the Global default automatically because `team_id` defaults to NULL.

Approve and I'll ship migration 1, wait for it to apply, then migration 2, then the UI.
