# One Open Round Robin panel — sandbox and live share the same code

## Goal
Today there are two separate panels with two different layouts:

- **Sandbox** (`OpenRoundRobinTestPanel.tsx`, ~2,300 lines) — the layout in your screenshot: Lead type badges, Agent chip with Reserved, "Held for you / X left to call" card, status dropdown, call buttons. All practice data in memory; nothing real ever moves.
- **Live pool** (`RollingRoundRobinLivePanel.tsx`) — the plainer table (Name/Phone/Reg/First call due...) shown in Lead Allocation, with the real "Run pass" buttons that hand out and pull back real leads.

You want **one version**: the sandbox layout becomes the single panel, shown in both the ORR Sandbox tab and the Lead Allocation live section. Edit it once and both update. The duplicate "green" live panel goes away.

## Approach

1. **Add a `mode` prop to `OpenRoundRobinTestPanel`**: `'sandbox' | 'live'`.
   - `sandbox` = exactly today's behaviour (practice leads, in-memory actions, never touches the database).
   - `live` = same layout and columns, but:
     - Loads **real** Open Round Robin leads from `sales_leads` (the same query the current live pool panel uses: leads with a first-call deadline, plus the open-pool waiting count).
     - The "Run pass" / release / claim actions call the **real** RPCs that exist today (`rolling_rr_reclaim_overdue`, `rolling_rr_distribute`, and the existing claim/sweep functions) instead of mutating local state.
     - Real actions are **enabled only when Open Round Robin is switched live** (the existing go-live switch) and the viewer is management. Until then the live view is read-only — same as today.
     - Practice-only buttons (Add test lead, Add round-robin lead, Clear practice run, practice notes) are hidden in live mode.

2. **Rewire `OrrSection.tsx`**:
   - The "Open Round Robin pool status" section in Lead Allocation renders `<OpenRoundRobinTestPanel mode="live" />` instead of `RollingRoundRobinLivePanel`.
   - The sandbox block and the ORR Sandbox tab keep rendering `<OpenRoundRobinTestPanel mode="sandbox" />`.
   - `RollingRoundRobinLivePanel.tsx` is no longer rendered anywhere; the file is removed (its logic moves into the shared panel's live mode).

3. **Keep every safety rule**:
   - Sandbox mode stays physically incapable of writing to the database (no Supabase imports on the sandbox path — writes only exist behind `mode === 'live'`).
   - Live writes stay gated behind the go-live switch + management role, exactly as now.
   - No changes to the round-robin trigger, flow settings, caps, or any other lead logic — this is a UI/panel merge only.

## What you'll see after
- Lead Allocation → Open Round Robin shows the same rich table as the sandbox (Lead type, Agent + Reserved, "Held for you / time left to call" card, status dropdown, call actions), but with real leads and real buttons.
- ORR Sandbox tab shows the identical table with practice data.
- One file to edit; both views always match.

## Files touched
- `src/components/admin/leads/OpenRoundRobinTestPanel.tsx` — add live mode (real data loader + real RPC actions).
- `src/components/admin/leads/OrrSection.tsx` — render the shared panel in both slots.
- `src/components/admin/leads/RollingRoundRobinLivePanel.tsx` — deleted (logic absorbed).
- Possibly a small new hook for the live-mode data load (real ORR leads + pool count).

## Not in scope
- No changes to pricing, New Leads, the Flow dropdown, or the auto-assignment trigger.
- No new lead-assignment behaviour — live mode uses the exact same RPCs the current live panel uses.
