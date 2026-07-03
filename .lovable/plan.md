## Goal
Let management pull leads from **multiple source agents** and redistribute them to **multiple destination agents** in one action, so imbalanced workloads can be rebalanced quickly.

## Current behaviour
- "Reassign All", "Split by %", "Exact count" modes: **one** From agent → **one** To agent.
- "Pick leads" mode: one From agent → many To agents (already multi).

## Changes

### 1. `BulkReassignDialog.tsx` — dialog state & flow
- Replace `fromAgent: string | null` with `fromAgentIds: Set<string>` (multi-select in every mode).
- Keep the existing `toAgentIds: Set<string>` and use it for **every** mode (not just cherry-pick). Retire the single-select `toAgent`.
- New "From agents" picker: same checkbox card style already used for cherry-pick "To agent" list.
- New "To agents" picker: reuse the same component so the two look consistent.
- `canContinue`: require at least one From and one To agent.

### 2. Count preview (`handleCheckCount`)
- Sum lead/customer counts across **all** selected From agents (`.in('assigned_to', [...fromAgentIds])`).
- For percentage/count modes, still show the combined total; the split logic runs per source.

### 3. Reassign execution (`handleReassign`)
- Loop over each `fromAgentId` in `fromAgentIds`.
- Round-robin the To agents across each source, so both source and destination sets get balanced:
  - `all` mode: for each source call `bulk_reassign_leads_to_agent` once per target chunk (split the source's lead ids across targets), OR call the existing RPC once per (source, target) with a `p_limit` proportional to that source's count / number of targets. Uses existing RPC — no DB change.
  - `percentage` / `count` mode: compute per-source limit then split across targets.
  - `cherry_pick` mode: unchanged distribution, but source pool is the union of selected From agents' leads.
- Aggregate `moved` + `customers_moved` totals for the toast.

### 4. `LeadPickerList` (cherry-pick)
- Accept `fromAgentIds: string[]` instead of a single id, and query with `.in('assigned_to', ids)`.
- Show a small "Agent" chip on each lead row so pickers can tell whose lead it is.

### 5. `ConfirmationStep`
- Accept `fromUsers: AdminUser[]` (array) and render the source list the same way the destination list is already rendered.

### 6. Copy / labels
- Dialog description: "Transfer leads from one or more agents to one or more agents to rebalance workloads."
- Section labels: "From agents (select one or more)" and "To agents (select one or more)".
- Toast: "Reassigned N records from X agents to Y agents".

## Technical notes (for the developer)
- No DB migration needed — the existing `bulk_reassign_leads_to_agent(p_from_agent, p_to_agent, ...)` RPC is called per (source, target) pair in a loop from the client. If a source has 0 matching leads for a target's slice, the call is skipped.
- Round-robin split preserves ordering by newest-first for percentage/count modes (RPC already selects newest first when `p_limit` is set).
- `useLeads`/`AgentsLeadsView` are unaffected — this change is contained to the reassign dialog + its subcomponents.

## Out of scope
- No changes to the underlying RPC.
- No changes to permissions — same roles that can open Reassign today still can.
- No auto-balancing suggestion ("distribute evenly across team") — only manual multi-select as requested.
