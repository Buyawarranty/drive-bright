Add "All Teams" option to Lead Team Colour dropdown and begin consolidating the `sales_manager` role into `performance_manager`.

## 1. "All Teams" lead-team option
In `UserPermissionsTab.tsx` (invite + edit dialogs), add an "All Teams" select option when the chosen role is a management role (`admin`, `super_admin`, `sales_manager`, `performance_manager`).
- Selecting it stores `null` in `lead_team_members` (i.e., no single-team restriction), which is the existing behaviour for managers.
- Label: "All Teams (no restriction)".
- Non-management roles (`sales`, `sales_lead`, etc.) continue to require a single team.

## 2. `sales_manager` → `performance_manager` consolidation
The user wants to stop using the `sales_manager` role and use `performance_manager` only. This is a wide-reaching change.

### UI / code changes needed
Add `performance_manager` (or swap `sales_manager` for `performance_manager`) in every role-based gate across the admin:
- `AdminDashboard.tsx` — default tab routing, tab access checks, role arrays
- `AdminSidebar.tsx` — sidebar tab visibility
- `NewLeadsTab.tsx` — team filter chips, leads-per-agent, team-overview visibility
- `LeadTeamsTab.tsx` — access to allocation/routing panels
- `SidebarTeamSwitcher.tsx` — team-switcher visibility
- `LeadsPerAgentTab.tsx` — management check
- `LeadRecoveryTab.tsx` — source visibility, CSV export, nav links
- `RetentionTab.tsx` — source visibility, nav links
- `CustomersTab.tsx` — assignment, customer-view permissions
- `CancellationsTab.tsx` — access checks
- `RefundsPaidTab.tsx` — sales-roles array
- `GetQuoteTab.tsx` — age-limit override permission
- `SalesScoreboardTab.tsx` — management definition
- `AgentsLeadsView.tsx` — agent fetch scope
- `StaffHubTab.tsx` — assignable roles list
- `MissedCallAlertBar.tsx` — already includes `performance_manager`
- `useSalesLeadTeamVisibility.ts` — comment update

### Permission template update
`src/lib/permissions/templates.ts`:
- Rename the `sales_manager` template key to `performance_manager` OR keep both keys but copy `sales_manager` permissions into `performance_manager`.

### Database migration required
1. **Enum / column update** — `admin_users.role` may reference `sales_manager`. If the column type is an enum, the enum must be updated. If it is `text`, existing rows must be migrated.
2. **Data migration** — any `admin_users` rows with `role = 'sales_manager'` must be flipped to `role = 'performance_manager'`.
3. **Permission policies** — any RLS policies or database functions that hard-code `sales_manager` must be updated.

## Technical note
`performance_manager` already exists as a selectable role in `UserPermissionsTab.tsx`, but it currently has **no** matching entry in `ROLE_TEMPLATES` in `permissions/templates.ts`. Its permissions are only defined inline in `UserPermissionsTab.tsx` (default tab permissions). `sales_manager` **does** have a full `ROLE_TEMPLATES` entry. We need to decide whether to:
- Map both keys to the same template, or
- Move the `sales_manager` template body under `performance_manager`.

Please confirm you want me to proceed with the full consolidation (including the database migration), or just the "All Teams" dropdown and a lighter label-only change.