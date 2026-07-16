---
name: Open Pool agent cards
description: What each agent chip in the Open Pool banner must display and how the numbers are calculated.
type: design
---

## Agent card contents

Each agent card in the Open Pool backlog banner must show, in this order:

1. **Mode indicator dot** — indigo for Round Robin, teal for Open Pool.
2. **Agent name**.
3. **Assigned today / daily cap** — e.g. `12/30 today`. This counts every lead whose `assigned_at` fell on the current UTC day and whose `assigned_to` is this agent. It must include re-allocated / recycled Open Pool leads, not just leads created today.
4. **Remaining capacity** — e.g. `18 left`.
5. **`full` badge** when remaining capacity is `0`.

## Calculation rule

- The banner must compute `assigned_today` by querying `sales_leads` with `.gte('assigned_at', todayStartUTC)` and grouping by `assigned_to`. It must not trust the `assigned_today` counter on `agent_distribution_caps`, because that counter is stale and only tracks newly created leads.
- `todayStartUTC` = `new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString()`.
- `remaining = daily_cap - assigned_today` (or `∞` if uncapped).

## Why this matters

Managers bulk-assign or auto-distribute Open Pool leads during the day. The stored `assigned_today` counter can lag or miss reassignments, so the card must read from the source of truth (`sales_leads.assigned_at`) to give an accurate live view of each agent's daily intake and remaining cap.