---
name: Fair fill lead distribution (mode-agnostic)
description: Inbound leads fan out fewest-today-first across ALL active agents regardless of Round Robin vs Open Pool mode
type: feature
---
**Rule:** `pick_agent_for_distribution` MUST NOT filter by `assignment_mode`. Every active, on-duty, unpaused sales/sales_lead agent is eligible — Open Pool agents receive auto-pushed leads exactly like Round Robin agents.

**Ordering (strict):**
1. `COALESCE(assigned_today, 0) ASC` — fewest leads today wins.
2. `last_assigned_at ASC NULLS FIRST` — tie-break.
3. `sort_order ASC` — final tie-break.

**Effect:** Given 4 active agents, leads 1–4 go one each. Lead 5 goes to whoever's still furthest below cap. Once a low-cap agent hits their `daily_cap`, they drop out and remaining leads continue to higher-cap agents automatically — no re-ordering needed.

**Do NOT re-add** `COALESCE(adc.assignment_mode,'round_robin') = 'round_robin'` to the picker's WHERE clauses. Open Pool mode is a UI hint about self-claim workflows; it does not exclude an agent from inbound distribution.

Priority tiers (`adc.priority` 1–4, NULL=999) still gate: lowest tier with any eligible agent wins the whole round.
