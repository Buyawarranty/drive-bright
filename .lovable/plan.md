# Weighted team distribution with caps + overflow

Replace the current "1st pick / 2nd pick" strict-priority router with a **weighted round-robin across teams**, layered on top of the existing **within-team round-robin**. Managers set a share % and a daily cap per (team, source), plus an overflow team for when a cap is hit.

## How the router will decide (per new lead)

```text
new lead arrives (source = google_ad)
        │
        ▼
1. Look up all teams with a rule for this source where allowed = true
2. For each team, check today's assigned count vs its daily cap
        │
        ▼
3. Pick the team whose "share debt" is highest
   (weighted round-robin: target share % vs actual share so far today)
        │
        ├── team has eligible agent? → assign via team's round-robin  ✓ DONE
        │
        ├── no eligible agent? → skip to next team by share debt,
        │                        DO NOT advance this team's pointer
        │                        (fair catch-up next time)
        │
        └── team is at daily cap? → route to that team's configured
                                    overflow team (recursive, same rules)
        │
        ▼
4. All teams exhausted → global fallback (existing Team Red live flow)
```

## Database changes

Extend `lead_team_source_rules` (already has `allowed`, `priority`, `min_conv_pct`, `notes`) with:

- `share_pct` int — target % of this source's leads for this team (0–100). All enabled teams' shares for a source should sum to 100; UI will warn if not.
- `daily_cap` int nullable — max leads/day for this (team, source). Null = unlimited.
- `overflow_team_id` uuid nullable — team that receives leads once daily cap is hit. Null = fall through to next team by share debt, then global pool.

New table `lead_team_daily_counters`:
- `team_id`, `source`, `date`, `assigned_count` — incremented on every successful assignment. Used for cap enforcement and share-debt math. Reset implicit by date.

## Router logic

New SQL function `route_lead_weighted(_source text)` that:
1. Loads today's counters for all enabled teams on this source.
2. Computes each team's **share debt** = `target_share − actual_share_today`.
3. Sorts teams by highest debt first (ties broken by team name for stability).
4. Walks the list: skip teams at cap (jump to their `overflow_team_id` if set, otherwise continue), skip teams with no eligible agent (leave pointer), assign to the first team that can take it.
5. Increments the counter and calls existing within-team picker (`pick_next_agent_for_team`) to choose the agent.
6. Falls back to global pool if no team can take the lead.

The existing per-team round-robin (agent slice %) is **unchanged** — this feature only decides *which team* gets the lead; the team decides *which agent*.

## UI changes (LeadRoutingDialog / Team Blue setup)

Replace the current 1st/2nd/3rd priority chips per source with a **share table**:

| Source     | Team Red | Team Blue | Team Green | Overflow → |
|------------|----------|-----------|------------|------------|
| Google Ad  | 70% cap:— | 30% cap:20 | off        | Team Red   |
| Facebook   | 50%      | 50%       | off        | Team Red   |

Each cell has: share % input, daily cap input (optional), and an on/off toggle. Below the table: an "Overflow team" selector per source.

Add a **live share preview** showing today's actual split so far (e.g. "Google today: Red 12 / Blue 6 — Blue is 2 leads under target").

Extend the existing routing tester to show the weighted decision trail (share debt at time of decision, cap status, overflow taken, etc.).

## Safety and rollout

- Master switch (`lead_distribution_settings.master_enabled`) stays as-is. Off = existing global Team Red flow only.
- Migration will seed defaults: Red 100% / Blue 0% for every source so behaviour is identical to today until a manager sets shares.
- All writes to `lead_team_daily_counters` happen in the same transaction as the lead assignment; a failure rolls back both.
- Add audit rows to `lead_assignment_audit` recording which team was chosen and why (share debt, cap hit, overflow taken).

## Files to touch

- **Migration** — extend `lead_team_source_rules`, create `lead_team_daily_counters`, create `route_lead_weighted` function, update the lead-creation trigger to call it when master switch is on.
- `src/components/admin/leads/LeadRoutingDialog.tsx` — new share table UI, overflow selector, live preview.
- `src/components/admin/leads/RoutingTester.tsx` — surface weighted decision trail.
- New helper hook to fetch today's per-team counters for the preview.

## Out of scope for this change

- Weekly/monthly caps (only daily for now).
- Per-agent overflow (overflow is team-level).
- Backfilling historical share % analytics.
