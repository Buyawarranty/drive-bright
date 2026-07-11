# Renewal Pool (Open Pool for renewals)

Add a second Open Pool — the **Renewal Pool** — that reuses the same UX and locking pattern as the New Leads Open Pool, but only for **orphan / unclaimed / stale renewals**. Active, owned renewals are untouched and stay on the current owner's list.

Round robin stays exactly as it is. New Leads Open Pool stays exactly as it is. This is purely additive.

## Scope rule (what enters the pool)

A renewal is eligible for the Renewal Pool only if **all** are true:
- Renewal is due within the configured window (default: next 30 days).
- One of:
  - No owner assigned, OR
  - Owner is inactive / off-roster / offline for N days (default 3), OR
  - Untouched (no logged activity) for N days (default 7).
- Not already `converted` / `lost` / `do_not_contact`.

Anything else stays on its current owner's renewal list. No auto-stripping of live owned renewals.

## UX (mirrors New Leads pool exactly)

- On the Renewals tab, show a compact emerald bar above the table: `Renewal Pool · X available · [Take Next Renewal]`.
- Click → RPC reserves one renewal for that agent for ~2 minutes.
- The reserved renewal is **pinned as the first row** of the existing renewals table with a mint highlight and a small countdown chip. No modal, no separate reveal.
- Ownership stamps permanently on first meaningful action (quote sent, call logged, status change). Otherwise the reservation lapses and it returns to the pool.
- Same "quiet" palette — no red for the ordinary flow.

## Settings

New independent toggle in Lead Teams → Allocation, per team:
- `Renewal Pool: Off / On`
- Window (days), staleness threshold (days), owner-inactive threshold (days), hold seconds.

The existing per-agent workstream toggle (Round Robin / Open Pool) on the **New Leads** row is unchanged. A new **Renewals** row gets its own toggle: `List-pick` (today) / `Open Pool`. Recontact stays list-pick only.

## Technical section

**DB / RPC (new migration)**
- Add columns to renewals source table (whichever is currently used for the renewal queue — likely `customer_policies` / `renewal_offers`):
  - `pool_status text` (`available` | `calling_locked` | `owned`)
  - `locked_by uuid`, `locked_at timestamptz`
  - `pool_eligible_at timestamptz` (computed by a nightly job + on write)
- New RPC `renewal_pool_get_next(_agent uuid)` — same shape as `open_pool_get_next`:
  - Locks one eligible row (`FOR UPDATE SKIP LOCKED`), sets `pool_status='calling_locked'`, `locked_by`, `locked_at`, returns the id.
- New RPC `renewal_pool_release_expired()` — cron every minute, releases rows where `locked_at < now() - hold_seconds` and no owning action has been logged.
- New RPC `renewal_pool_stamp_ownership(_renewal, _agent)` — called from the "first meaningful action" hooks (call log, quote send, status change) to flip `pool_status='owned'` and set owner.
- Settings row in existing `shark_tank_settings` table (rename column comment to "open pool" — no rename of table to avoid churn), add `renewal_enabled`, `renewal_window_days`, `renewal_stale_days`, `renewal_owner_inactive_days`, `renewal_hold_seconds`.
- GRANTs: `authenticated` execute on the new RPCs.

**Frontend**
- New `src/components/admin/leads/RenewalPoolBar.tsx` — clone of `OpenLeadPoolBar.tsx`, points at `renewal_pool_get_next`, its own reservation store.
- New `src/hooks/useRenewalPoolReservation.ts` — clone of `useOpenLeadPoolReservation.ts` (separate module-scope store so a renewal reservation doesn't collide with a new-lead reservation).
- Mount `RenewalPoolBar` above the renewals table in the Renewals tab.
- Extend the renewals table to accept `pinnedRenewalId` + `reservedRemainingSec` and render the mint-highlighted pinned first row, same as `LeadsTable` does today.
- Wire the three "first meaningful action" hooks (quote send, call logged, status change) on renewals to call `renewal_pool_stamp_ownership`.

**Allocation matrix**
- Add a Renewals row per agent with `List-pick / Open Pool` toggle, mirroring the New Leads row. Caption: `Renewals only · picks from unowned / stale renewals`.

## Rollout

1. Ship DB migration + RPCs behind `renewal_enabled=false`.
2. Ship UI hidden unless `renewal_enabled=true` for the team.
3. You flip it on for one team to test; new leads pool untouched.

Confirm and I'll build it.
