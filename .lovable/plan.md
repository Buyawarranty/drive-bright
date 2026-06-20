## Leads per Agent — Daily Locked Tracking

### Scope
New tab on `/admin-dashboard/?tab=leads-per-agent` showing per-agent daily activity metrics. Visible to **everyone**, but agents only see their own row; **management** (admin, super_admin, sales_manager) sees all agents with totals.

### What gets tracked per agent per day (UK time, 00:00 → 23:59:59)
For each calendar day, per agent:
- **Leads assigned** — count where agent became the owner that day
- **Self-assigned** — leads they pulled to themselves
- **Marked Fake** — status changed to `fake_lead`
- **Marked Lost** — status changed to `lost`
- **Marked Converted** — status changed to `converted`
- **Notes added** — entries in `lead_quick_notes` / `lead_activities` of type note
- **Callbacks set** — entries in `lead_reminders` (callback type) created
- **Callbacks completed** — reminders marked done
- **Calls logged** — entries in `lead_call_logs`
- **Status changes** — total touch count (any change)
- **Active leads at end of day** — owned & not in terminal status

### Locking strategy (precise, immutable)
- Live counters for **today** computed on read from source tables (always real-time).
- At **00:01 UK time** a cron job snapshots the previous day into `agent_daily_lead_stats` (one row per agent per day) — those rows are immutable history.
- Reads: any date < today → snapshot table; today → live aggregation. Guarantees "lock down at midnight, starts at 00:00:01" behavior.

### Database
New table `agent_daily_lead_stats`:
- `agent_id`, `stat_date`, `team_id`
- `leads_assigned`, `self_assigned`, `marked_fake`, `marked_lost`, `marked_converted`
- `notes_added`, `callbacks_set`, `callbacks_completed`, `calls_logged`
- `status_changes`, `active_leads_eod`
- `locked_at` (timestamptz) — set when snapshot written; presence = locked
- Unique `(agent_id, stat_date)`

RLS:
- Agents → SELECT only rows where `agent_id = auth.uid()`
- Management → SELECT all
- Only `service_role` writes (cron + edge function)

Plus a SECURITY DEFINER function `get_agent_live_stats(p_date date)` that computes today's numbers from source tables on demand, with the same role filtering baked in.

### Edge function + cron
- `snapshot-agent-daily-stats` — aggregates yesterday from `sales_leads`, `sales_leads_changelog`, `lead_quick_notes`, `lead_reminders`, `lead_call_logs`, `lead_activities`; UPSERTs into `agent_daily_lead_stats` with `locked_at = now()`.
- pg_cron at `01 00 * * *` Europe/London (run at 00:01 UK).
- Manual "Rebuild day" button for management (calls same function with explicit date).

### UI — `src/components/admin/LeadsPerAgentTab.tsx`
Layout:
1. **Header bar**: Date range tabs — `Today` · `Yesterday` · `This Week` · `This Month` · `Custom range`. Live indicator dot pulsing when viewing Today; lock icon + "Locked at HH:MM" badge for past days.
2. **Summary cards (management only)**: Total leads worked · Total fake · Total converted · Total callbacks · Total calls — across selected range.
3. **Main table** — sortable, sticky header, agent avatar + name + team chip, columns for each metric, "Active EOD" pinned right. Total row at bottom (management view).
4. **Agent view (non-management)**: Same layout but single-row scoped to themselves; adds a "My streak" mini stat.
5. **Per-agent expand**: clicking a row opens a drawer with daily breakdown chart for the selected range (recharts bar chart) + the same metrics tallied weekly / monthly.
6. **Empty states + loading skeletons**, CSV export (management only, gated by existing export rules).

Design tokens only (no hardcoded colours); follows existing admin dashboard table conventions; high-contrast borders per memory.

### Wiring
- Register tab in the admin dashboard tabs list with id `leads-per-agent`.
- Role-aware fetch hook `useAgentDailyStats(range, agentId?)` — picks snapshot vs live per date; merges results.

### Out of scope
- Backfilling historical days before today (can be triggered manually via the rebuild button per date once shipped).
- Editing/overriding snapshot numbers (immutable by design).