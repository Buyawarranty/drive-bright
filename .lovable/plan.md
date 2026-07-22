# Open Round Robin — 7-Attempt Contact Schedule

Replace the current simplified ORR sweep (2-min window → 10-min retry → dormant after 7) with the full attempt-based schedule you specified. Team Red and Team Green flows stay untouched.

## Behaviour to enforce

| Attempt | Release trigger |
|---|---|
| 1 | Within 2 min of assignment |
| 2 | Exactly 10 min after Attempt 1 completes |
| 3 | 5:30pm same day if Attempt 2 by 3:30pm — else 10:00am next business day |
| 4 | 10:00am next business day after Attempt 3 |
| 5 | 1:00pm, 2 business days after Attempt 4 |
| 6 | 5:30pm, 2 business days after Attempt 5 |
| 7 | 10:00am, 3 business days after Attempt 6 |
| After 7 | Status → `dormant_no_contact`, removed from pool, all releases cancelled, history retained |

Rules that apply at every release:
- Lead opens to eligible Team Blue agents; first claim wins.
- Claimant gets a 2-min call window; if no call starts, lead passes to the next eligible agent.
- Passing between agents does NOT increment attempt count — only an actual outbound call does.
- If customer answers at any attempt: stop schedule, remove from ORR, cancel future releases, assign to the answering agent permanently.

Weekends and UK bank holidays are excluded from "business day" math.

## Technical details

### DB changes (one migration)

- Columns on `sales_leads`:
  - `orr_attempt_count int default 0` — real attempts (calls made), not agent passes
  - `orr_next_release_at timestamptz` — when the lead next opens to the pool
  - `orr_last_attempt_at timestamptz` — end time of most recent call
  - `orr_locked_until timestamptz` — hard lock; sweep ignores until this passes
  - Reuse existing `orr_first_call_deadline` for the 2-min claim window
  - New status value: `dormant_no_contact`
- Table `uk_bank_holidays(holiday_date date primary key)` seeded 2026–2028, plus `GRANT SELECT ... TO authenticated`.
- Function `next_business_day(from_ts timestamptz, days int) returns timestamptz` — skips Sat/Sun and rows in `uk_bank_holidays`, returns the target date at the given time-of-day (caller supplies via wrapper).
- Function `compute_next_orr_release(attempt int, last_attempt_at timestamptz) returns timestamptz` — encodes the table above (London timezone anchored, converted back to UTC for storage).
- Rewrite `sweep_open_round_robin()`:
  1. For leads at `orr_locked_until > now()`: skip.
  2. For leads at `orr_next_release_at <= now()` and no current claimant: assign to next eligible Team Blue agent via `pick_agent_for_distribution`, set `orr_first_call_deadline = now() + 2 min`, log audit `orr_release_attempt_N`.
  3. For leads with expired `orr_first_call_deadline` and no call logged since assignment: clear `assigned_to`, pass to next eligible agent (no attempt increment), log audit `orr_passed_no_call`.
  4. When a call IS logged: increment `orr_attempt_count`, set `orr_last_attempt_at`, compute `orr_next_release_at = compute_next_orr_release(...)`, set `orr_locked_until = orr_next_release_at`, clear the 2-min deadline.
  5. If attempt count reaches 7 and next call still unanswered → `status = 'dormant_no_contact'`, clear release + assignment.
- Trigger on `lead_call_logs` insert (for Team Blue leads): performs step 4 above so the attempt count only advances on real calls.
- Trigger on `sales_leads` update: when `status` moves to `converted`/`contacted-answered`, clear `orr_next_release_at`, `orr_locked_until`, remove from ORR.
- pg_cron sweep frequency stays at 60s.

### Frontend (`OpenRoundRobinPanel.tsx` + `OpenRoundRobinTestPanel.tsx`)

- Replace the "In 10-min retry" tile with **"Next release ≤1 hr"** count.
- Add tiles: **Attempt 3–7 in queue** (grouped small chips), **Dormant today** stays.
- Rules block: replace the 5-line list with the full 7-attempt table shown above.
- Test panel: add a "Fast-forward to next release" action that sets `orr_next_release_at = now() - 1s` on a synthetic lead so managers can watch attempts 2→7 fire without waiting real business days.

### Safety

- Feature flag `lead_distribution_settings.open_round_robin_enabled` still gates the whole sweep — flip it off to freeze behaviour.
- All state transitions logged to `lead_assignment_audit` with reasons `orr_release_attempt_N`, `orr_passed_no_call`, `orr_dormant_no_contact`, `orr_customer_answered`.
- Team Red / Team Green completely untouched; sweep filters `team_id = team_blue_id` only.
- Bank holiday table can be edited by managers; missing rows just mean that day counts as a business day (fail-open).

Confirm and I'll ship the migration + panel updates.
