## Open Round Robin — Live Wiring (Team Blue only)

Goal: make the "Open Round Robin · Team Blue Beta" panel actually enforce the rules it documents. Team Red flow stays untouched.

### Behaviour to enforce

1. **Auto-assign on arrival** — new Team Blue leads are already routed via `pick_agent_for_distribution` (fair-fill). No change here.
2. **2-minute first-call window** — if the assigned agent doesn't start a call within 2 minutes of assignment, the lead is reclaimed and re-assigned to the next available Team Blue agent.
3. **10-minute retry window** — if the first call happens but ends in no-answer, the same agent keeps the lead for 10 minutes to retry.
4. **Return to queue** — if the retry window lapses with no further call, the lead re-enters the Team Blue round-robin queue.
5. **7 attempts → dormant** — once a lead has 7 call attempts logged with no contact, status flips to `dormant` and it leaves the queue.

### Backend changes (one migration)

- New column `sales_leads.orr_first_call_deadline timestamptz` (only used for Team Blue leads) — set to `assigned_at + 2 min` on assignment.
- New column `sales_leads.orr_reassign_count int default 0` — bumped every time a lead is reclaimed by the sweep.
- New function `public.sweep_open_round_robin()` (SECURITY DEFINER):
  - For Team Blue leads where deadline passed and no `lead_call_logs` row exists since `assigned_at`: clear `assigned_to`, call `pick_agent_for_distribution(team_blue_id, source)`, set new deadline, increment `orr_reassign_count`, insert `lead_assignment_audit` row with reason `orr_missed_first_call`.
  - For leads with ≥1 call logged and no contact: enforce 10-min retry window; if it lapses, same reclaim path.
  - For leads with ≥7 call attempts and no contact: set `status='dormant'`, clear `assigned_to`.
- New trigger on `sales_leads` insert/update: when a Team Blue lead gets an `assigned_to`, set `orr_first_call_deadline = now() + interval '2 minutes'`.
- pg_cron job running `sweep_open_round_robin()` every 60 seconds.

### Frontend changes

- `OpenRoundRobinPanel.tsx`: replace static status banner with **live** counters pulled from Supabase:
  - Leads currently in 2-min window
  - Reassignments in last hour
  - Leads gone dormant today
  - "Sweep last ran" timestamp
- Realtime subscription on `sales_leads` filtered to Team Blue so counters update as sweeps happen.
- Small "Run sweep now" button (management only) that invokes the RPC on demand.

### Safety

- Team Blue team id is resolved by name lookup in the migration (no hard-coded UUID in code).
- Sweep only touches leads where `team_id = team_blue_id` — Team Red and unassigned pool logic is unchanged.
- All reclaims logged to `lead_assignment_audit` so managers can trace movement.
- Feature flag column `lead_distribution_settings.open_round_robin_enabled boolean default true` on the Team Blue row so you can flip it off instantly if it misbehaves.

Confirm and I'll ship the migration + panel updates.