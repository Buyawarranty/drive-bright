# ORR Test Lab — Simulate agent mode

## Goal
Let a manager pretend to be a specific sales agent (e.g. Freddie, James) and watch synthetic `[ORR_TEST]` leads flow into their New Leads view, trigger the pop-up alert with beep, tick the 2‑minute countdown, and get reclaimed on expiry — exactly as that agent would experience it in production. All frontend; no Supabase, RPC, or schema changes.

## What you'll be able to do
1. Open **ORR Test Lab**.
2. Pick an agent from a "Simulate as" dropdown (any active sales / sales_lead user).
3. The whole admin dashboard immediately renders as if you were that agent — including New Leads scoping, alert pop-ups, countdown badges, "Take this lead" buttons.
4. In another browser tab (or split view), stay as manager in the Test Lab and press **Create test lead**. The synthetic lead is distributed by the real ORR engine.
5. Watch it appear in the "simulated" tab within seconds, alert pops with the beep, countdown ticks down. Miss the 120s and see it flip to the next agent when you press **Run sweep**.
6. Press **Stop simulating** to return to your own view. Nothing was written server-side — impersonation is a client-only UI overlay.

## How it works (technical)
- The app already has `ViewAsContext` and `useImpersonation` used elsewhere to view the CRM as another user. We reuse this. No new hooks, no DB writes.
- New component `AgentSimulatorBar.tsx` inside the Test Lab:
  - Loads active `admin_users` where `role in ('sales','sales_lead')` (read-only query, already permitted).
  - Sets `viewAs` to that agent's id via existing context setter.
  - Shows a persistent yellow banner while active: "Simulating <Name> — you are seeing what they see. Stop simulating.".
- `OrrTestLabPage.tsx` gains an "Open real New Leads tab" link so managers can flip between Lab (create/expire/sweep controls) and New Leads (agent-view outcome) in two windows.
- Manager controls in the Lab (Create test lead, Expire window, Run sweep, Delete all) stay available even while simulating — they're gated by the real admin session, not the impersonation overlay.

## Files touched (frontend only)
```text
src/components/admin/leads/OrrTestLabPage.tsx      # add simulator bar + how-to steps
src/components/admin/leads/AgentSimulatorBar.tsx   # NEW — agent picker + banner
```

## Not touched
- No Supabase migrations
- No edge functions
- No RPC changes
- No changes to `OpenRoundRobinTestPanel`, `AllocationMatrix`, alert panels, or the ORR distribution engine
- No new tables, columns, or policies

## Suggested test script
1. Window A: manager in **ORR Test Lab**, click **Simulate as: Freddie**.
2. Window B (incognito or second profile, or just a second tab if you don't need two identities): open `?tab=new-leads`.
3. Window A: click **Create test lead**.
4. Verify in Window B: pop-up alert fires with beep, row appears with 2:00 countdown, phone shows `TEST123` reg.
5. Wait / click **Expire window** on the row in Window A.
6. Window A: click **Run sweep** → row's Assigned-to flips to next agent in the retry ladder.
7. Window A: **Delete all test leads** to clean up.

Approve to proceed?
