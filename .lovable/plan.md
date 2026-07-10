
# Renewals Queue — mirror Recontact Leads UX

Goal: Rebuild the `?tab=renewals` view so it looks and behaves exactly like `?tab=recontact-leads` (segment tabs, bulk actions, leaderboard, assignment, callbacks, LeadDetailsPanel, callback banner, unified date filter), but sourced from customer warranty expiry data and sorted by soonest renewal first. No changes to New Leads or Recontact Leads.

## Isolation guarantees

- `LeadRecoveryTab.tsx` (Recontact Leads) — not edited, not imported anywhere new.
- `NewLeadsTab` / `LeadsTable` / lead hooks — not edited.
- `RetentionTab.tsx` — left on disk as a rollback safety net, simply unrouted from the dashboard.
- Only 3 files touched: 2 new, 1 one-line swap.

## Scope

### 1. New file: `src/components/admin/RenewalsQueueTab.tsx`
Structural copy of `LeadRecoveryTab.tsx`. Same layout, same components, same styling, same interactions:
- Unified date filter (reuse existing `AdminDateFilter`).
- Segment tab strip.
- Bulk selection + bulk actions bar.
- Leaderboard panel.
- Assignment dropdowns.
- Callback banner + callback scheduler.
- `LeadDetailsPanel` drawer for row detail.
- Same table columns/typography/badges, plus one new column: **Renews in** (days-to-expiry, red ≤14d, amber ≤30d, grey otherwise).

### 2. New file: `src/hooks/useRenewalsQueue.ts`
Data source = `customers` joined with their latest `customer_policies` row to derive:
- `expiry_date` (policy end date incl. any bonus-month extensions — reuse existing policy-expiry helper).
- `plan_length_months` (12 / 24 / 36).
- `days_to_expiry`.
- `renewal_status` (see outcomes below).

Segments:
- Due today
- Due in 7 days
- Due in 30 days
- Due in 60 days
- In renewal window (0–30d)
- Upsell candidates (customers eligible for longer plan)
- Lapsed (expired, not renewed)
- All renewals

Renewal outcomes (status pill, editable inline like Recontact Leads outcome):
- Renewed
- Upgraded
- Renewed + Upgraded
- Still considering
- No answer
- Declined
- Cancelled at renewal
- Lost to competitor

### 3. Sorting rules
- Primary: soonest `expiry_date` first (ascending).
- Overdue-not-renewed pinned to the very top.
- Rows with outcome = Renewed / Upgraded / Renewed+Upgraded drop out of the active queue (visible only under an "All renewals" segment filter toggle).

### 4. Routing swap in `src/pages/AdminDashboard.tsx`
One line: `case 'renewals':` renders `<RenewalsQueueTab />` instead of `<RetentionTab />`. Nothing else in the dashboard changes.

## Technical notes

- No schema changes. `renewal_status` stored on `customer_policies` if a column already exists; otherwise added via a small migration with GRANTs + RLS (admin/super_admin/sales_manager/sales_lead write, sales read own team) — will confirm before running.
- Reuses: `AdminDateFilter`, `LeadDetailsPanel`, callback banner/scheduler, leaderboard component, bulk-action bar, assignment dropdown, agent color map, click-to-dial Zoiper injection.
- Respects existing memory rules: management = admin/super_admin/sales_manager only; sales_lead is not management; date normalization via `Date.UTC`; team filter scope unchanged; no placeholder data.
- Impersonation (`useViewAs`) respected identically to Recontact Leads.

## Out of scope

- No changes to Recontact Leads, New Leads, Live Leads, or any lead hook.
- No changes to `LeadsTable`, `useLeads*`, callback logic used by other tabs (consumed as-is).
- No visual redesign — pixel-for-pixel parity with Recontact Leads except the extra "Renews in" column and renewal-specific segments/outcomes.

## Rollback

Revert the one-line dashboard swap → `RetentionTab` is back instantly; the new files can stay dormant.
