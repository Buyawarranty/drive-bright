# Open Round Robin — Live + Overnight Allocation (Sandbox-first)

Build the full ORR model from the brief on top of the existing sandbox. **ORR stays SANDBOX-only** — no real customer leads enter ORR until an authorised manager explicitly activates it per team.

## Phase 1 — Data model (migration)
- `lead_teams`: add `distribution_method` (ROUND_ROBIN | OPEN_ROUND_ROBIN) and `distribution_environment` (SANDBOX | LIVE), defaults ROUND_ROBIN / LIVE so existing teams are untouched.
- Leads: add `original_distribution_method`, `distribution_team_id`, `distribution_environment`, `lead_entry_type` (LIVE | OVERNIGHT), `original_lead_datetime`, `customer_browse_started_at`, `orr_eligible_at`, reservation fields (`orr_reserved_agent_id`, `orr_reserved_at`, `orr_reservation_expires_at`), contact fields (`first_contact_at`, `contacted_agent_id`, `orr_contact_day`). Original values never rewritten.
- New tables: `orr_agent_availability` (READY / WORKING_ORR / FOCUS_CURRENT_LEADS / UNAVAILABLE, `last_orr_allocation_at`, `orr_rotation_position`), `orr_attempts` (attempt history: agent, day, number, outcome).
- `orr_config`: add configurable weekend attempts/day (default 1), min retry gap (default 3h), `overnight_max_wait_minutes` (default OFF).

## Phase 2 — Sandbox routing
- Route practice leads by team → method → environment. SANDBOX teams only ever get practice leads; real leads always use existing production Round Robin. A lead can never be in both engines.
- Lead entry type: LIVE during contact hours (green ⚡), OVERNIGHT outside (blue 🌙).

## Phase 3 — Core allocator
- Overnight queue: eligible at 09:00, oldest first, never batch-assigned; one active reservation per agent, rest stay in the shared queue.
- Live leads: 2-minute customer browsing window before eligibility; Live priority over Overnight for the *next* free agent only — never interrupt an active reservation.
- 2-minute reservation per agent, then released back to the queue (no attempt counted).

## Phase 4–5 — Call outcomes + retry engine
- Outcomes: call started → contacted (agent keeps customer, lead stays ORR historically) / customer unavailable (attempt recorded, lead returns for next eligible retry, may go to any agent) / reservation lapsed (no attempt, next agent).
- Retry rules: 2 genuine attempts per weekday, 1 per weekend day (configurable), 3-hour minimum gap (configurable), 7 contact-day journey. Stops on purchase, opt-out, invalid number, closure, or day 7.

## Phase 6 — Dynamic staffing
- Availability-driven rotation: staggered starts (09:00 / 09:15 / 10:00), weekend ad-hoc logins, breaks. Late starters join the fair rotation from when they become Ready — no catch-up, no redistribution of active work. Nobody Ready → leads wait; allocation resumes automatically.

## Phase 7 — Agent UI
- Existing sales lead table keeps its design. Agent sees max ONE ORR opportunity at the top: pale-green row, "OPEN ROUND ROBIN ⚡ Live / 🌙 Overnight", "Reserved for you", countdown, "Day X of 7 · Attempt Y of 2", subtle green progress bar. Lead Date keeps the original submission time. Positive wording only ("Reserved for you", "Customer unavailable — next contact scheduled").
- Agents never see queue size, other agents' reservations, source/agency/campaign. They do see customer activity (viewed prices, checkout, etc.).

## Phase 8 — Manager UI
- Full ORR view in the Sandbox section: Live/Overnight/Retry waiting counts, agents by availability state, oldest waiting lead, average Time to Lead and Time to Contact, calls/contacts/quotes/sales/conversion/revenue, plus source visibility.

## Phase 9 — Sandbox test controls
- Add Live/Overnight practice leads, overnight batch, simulate 09:00 release, browsing, contact, unavailable, retry advance, staggered agent starts, weekend session, clear/reset. Never touches production data.

## Phase 10 — Go-live controls
- Separate Sandbox vs Live configs; sandbox changes never auto-apply to live. Team-level "Activate Open Round Robin" with explicit confirmation (team name, current vs new distribution, new leads only, existing RR leads continue). Existing Round Robin teams completely unchanged.

## Verification
- Build the 10 acceptance tests from the brief (09:00 overnight start, Live priority, 09:15/10:00 starts, weekend ad-hoc, no-answer, contact, reservation lapse, sandbox protection, RR+ORR side-by-side) as sandbox simulations and run them.
- Preview-only; nothing published without your say-so.

## Technical notes
- Reuses existing `OrrSandbox*` components, `useOrrSandboxAllocations`, `orr_config` and related tables where possible; new fields/tables added via one migration with GRANTs + RLS (management-only for ORR config/queue data).
- Allocation runs as a Postgres function so timing rules (09:00 release, 2-min windows, retry gaps) are server-side, not browser-dependent.
