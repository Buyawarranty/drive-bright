
# Controlled Shark Tank — Build Plan (ships OFF)

Ships fully built but **globally disabled**. Nothing routes through it until Sales Manager flips the master switch. Zero impact on Team Red live flow.

## 1. Master switch (safety)

New row in `admin_config`:
- `shark_tank_enabled` = `false` (hard default)
- `shark_tank_team_ids` = `[]` (which teams opt in)

Every entry point checks `shark_tank_enabled === true` AND lead's team is in `shark_tank_team_ids`. Otherwise the existing round-robin path runs untouched.

## 2. Data model

**New table `shark_tank_pool`**
- `lead_id` (FK sales_leads, unique)
- `team_id`
- `status`: `queued` | `held` | `retry_hold` | `chase_hold` | `claimed` | `expired`
- `held_by` (admin_user_id, nullable)
- `held_until` (timestamptz) — 60s call-start timer
- `retry_until` (timestamptz) — +15min protected retry window
- `chase_release_at` (timestamptz) — +1h return-to-pool point
- `attempt_count` (int)
- `last_outcome` (text)
- `created_at`, `updated_at`

**New table `shark_tank_audit`** — append-only
- `lead_id`, `actor_id`, `action` (`queued`|`taken`|`revealed`|`call_logged`|`released_no_answer`|`retry_started`|`chase_locked`|`returned_to_pool`|`claimed_owned`|`expired_by_worker`), `payload` jsonb, `created_at`

Both tables: standard GRANTs, RLS scoped to team visibility + management.

## 3. State machine

```text
new lead → queued
  ↓ agent clicks Take Next Lead
held (60s, held_by=agent, phone revealed)
  ↓ agent logs outcome within 60s
  ├─ answered + valid next-action + call-ref → claimed (owned by agent)
  ├─ no-answer → retry_hold (15min, same agent only)
  │     ↓ agent retries + logs
  │     ├─ answered → claimed
  │     └─ no-answer → chase_hold (locked until +1h from first take)
  │           ↓ chase_release_at
  │           → queued (any agent)
  └─ timer expires with no log → returned_to_pool + audit flag
```

Rules enforced server-side in one RPC `shark_tank_take_next(team_id)`:
- atomic `UPDATE ... WHERE status='queued' RETURNING` — no double-take
- respects agent daily cap, presence=active, not paused
- one active hold per agent (anti-hoarding)
- phone number only returned by the RPC response, never pre-fetched
- cooldown 15s between takes

RPC `shark_tank_log_outcome(lead_id, outcome, next_action, call_reference)`:
- validates agent owns the hold
- enforces required fields for `answered` (next_action + call_reference non-empty)
- transitions state per machine above

## 4. Background worker

`pg_cron` every 15s runs `shark_tank_reap()`:
- expire `held` past `held_until` → back to `queued`, audit `expired_by_worker`
- expire `retry_hold` past `retry_until` → `chase_hold`
- release `chase_hold` past `chase_release_at` → `queued`

Cron job created but attached to the master switch — worker no-ops when `shark_tank_enabled=false`.

## 5. UI (all inside Lead Allocation tab)

New collapsible section **"Shark Tank (Experimental)"** below Rebalance Leads, management-only:

- Big red master toggle: **OFF** by default with warning copy: "This changes how leads are distributed. Test with one team first."
- Team multi-select: which teams participate
- Per-team knobs (read from `lead_teams` extension cols): call-start timer (default 60s), retry window (15m), chase lock (60m), max concurrent holds per agent (default 1), require call-reference on claim (default on)
- Live counters: queued / held / retry / chase / claimed today
- "Dry-run mode" toggle — writes to `shark_tank_pool` + audit but **does not** stop round-robin, so we can compare before cutover

Agent-facing tray (rendered only when master switch on AND agent's team opted in):
- Sits above the leads list in New Leads tab
- Single **Take Next Lead** button, disabled unless presence=active and cap not reached
- Countdown ring during 60s hold, big red "Log Outcome" panel with required fields
- Retry banner during 15min retry window
- No PII shown until `Take` is clicked

## 6. Guardrails already covered

- No cherry-picking: phone hidden until take, only one lead served
- No duplicate calling: atomic take + team-scoped queue
- No ownership without contact: `claimed` requires `answered` + valid log
- Full audit trail per action
- Terminal statuses (lost/converted/fake_lead) never re-enter — enforced at queue-insert trigger

## 7. Rollout (recommended, not automatic)

1. Ship with switch OFF — verify tables, RPCs, UI render, no side effects on Team Red.
2. Turn on **Dry-run** for Team Blue only — compare timings against round-robin for 1 week.
3. Flip Team Blue to live Shark Tank; keep Team Red on round-robin.
4. Decide based on time-to-first-call + contact rate.

## Technical notes

- Table: `shark_tank_pool` + `shark_tank_audit` with GRANTs to `authenticated`/`service_role`, RLS via `has_role` and team membership.
- RPCs: `shark_tank_take_next`, `shark_tank_log_outcome`, `shark_tank_reap` — all `security definer`, `set search_path=public`.
- Queue insert: trigger on `sales_leads` insert/update — only fires when master switch on and team opted in; skips terminal statuses.
- Realtime: enable publication on `shark_tank_pool` so agent trays update live.
- Config surfaced through `useAdminConfig('shark_tank_enabled')` — existing hook.
- New files: `SharkTankPanel.tsx` (management), `SharkTankTray.tsx` (agent), `useSharkTank.ts` (RPC calls + realtime).
- No changes to `useLeadDistribution`, `SalesExecutiveHeader`, or round-robin RPCs — parallel system.

Approve and I'll build it in this order: migration → RPCs → hook → management panel → agent tray → cron worker.
