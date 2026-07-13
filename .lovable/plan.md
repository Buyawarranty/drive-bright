# Lead Distribution: Round-Robin ↔ Open Pool (Alternating 1:1)

## What you'll get

A single **Distribution Control** panel on Lead Teams where you set, per day:

1. **Which agents are on Round-Robin** (with a daily cap each)
2. **Which agents are on Open Pool** (self-serve, with a daily cap each)
3. **Overflow agents** (who gets leads when *both* flows are capped)

Every new lead is routed **1-to-1, alternating**: lead #1 → Round-Robin, lead #2 → Open Pool, lead #3 → Round-Robin, and so on. Both pools grow at the same rate. Seniors can sit in either flow.

## How the router decides

```text
New lead arrives
   │
   ▼
Next slot = RR or Open Pool? (alternating counter)
   │
   ├── RR slot ──► Pick next RR agent with cap remaining ──► Assign
   │                    │
   │                    └── All RR agents capped? ──► Give to Open Pool instead
   │
   └── Open Pool slot ──► Drop into Open Pool queue (self-serve)
                          │
                          └── Pool at daily cap total? ──► Give to RR instead
                                                             │
                                                             └── Both capped? ──► Overflow agents
```

The alternating counter is per-day and resets at 8am.

## Per-agent daily caps

Each agent row (in either flow) has:
- **Flow:** Round-Robin | Open Pool | Off
- **Daily cap:** e.g. 30 (0 = paused)
- **Today's count:** live tally

When an agent hits their cap, the router skips them. When *everyone in a flow* is capped, that flow's next turn spills to the other flow. When both are exhausted, leads go to your named **overflow agents**.

## Daily reset (8am, configurable)

- All "today's count" tallies zero out
- Alternating counter resets to RR-first
- Caps and flow assignments stay as you set them (no need to redo the plan daily)
- You can change the reset time or disable it

## Open Pool = self-serve only

New staff (and any seniors you put in Open Pool) click **"Take next lead"** to pull the oldest waiting lead. No auto-assign, no timers, no snap-back. Their daily cap stops them pulling more than you allow.

## Overflow

You nominate 1–N overflow agents (existing feature, extended). They only receive leads when **both** RR and Open Pool are fully capped for the day. Leads to overflow agents also count against *their* own daily cap; past that, leads sit in a holding queue until 8am reset or you raise a cap.

---

## Technical details

**DB changes** (one migration):
- `lead_distribution_settings`: add `flow_mode` ('alternating' | 'rr_only' | 'pool_only'), `alternating_counter_date`, `alternating_next` ('rr' | 'pool'), `daily_reset_hour` (default 8).
- `agent_distribution_caps`: add `flow` column ('round_robin' | 'open_pool' | 'off'). Existing `daily_cap` reused for both flows.
- New table `lead_distribution_daily_state` (agent_id, date, count) — cheap per-day tally, indexed on (date, agent_id). Zeroed via cron at reset hour.

**Router change** (`assign-lead` edge function / `assignLead` RPC):
- Read `alternating_next` for today; if row missing, initialise to 'rr'.
- Route to that flow's picker; on success, flip `alternating_next`.
- Each picker filters caps by `flow` + today's count < cap.
- Fallback chain: preferred flow → other flow → overflow recipients → holding.

**UI** (`src/components/admin/leads/LeadTeams*`):
- New **Distribution Control** card at top of Lead Teams tab.
  - Toggle: Flow mode (Alternating / RR only / Pool only)
  - Reset hour picker
  - Live "Today so far: RR X | Pool Y | Overflow Z" counter
- Agent Caps table gains a **Flow** dropdown column (RR / Open Pool / Off).
- Open Pool tab gets a **"Take next lead"** button for self-serve agents.

**Cron:** existing pg_cron job extended to reset `lead_distribution_daily_state` and `alternating_counter_date` at the configured hour.

**No changes** to: Team Red/Blue fallbacks, terminal-status guards, dedup logic, backup/recovery — all preserved.

---

## Open questions before I build

1. Reset hour: **8am UK** okay, or different?
2. When both flows are capped, do overflow agents get leads **immediately** (bypassing their own cap) or **respect their cap** (leads wait in holding)?
3. Should the "Take next lead" self-serve button pull the **oldest** lead, or let the agent pick from a visible pool list?
