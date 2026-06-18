# Lead Recovery — New Admin Section

A dedicated workspace for an agent to chase aged/unworked leads, with the **full toolkit** of the New Leads section (calls, notes, reminders, quotes, statuses) but a different queue order and filters. Live Team Red flow is not touched.

## Order of work (oldest leads worked first)

The queue defaults to **oldest `created_at` first** within each segment, so nothing rots at the bottom. Agent works top-down.

### Segment tabs (left → right, in priority order)

```
1. Never Contacted   → created >30 days ago, 0 call logs, 0 notes
2. Quote Sent, Cold  → quote sent, no reply in 14+ days
3. Contacted, Stalled → last_contacted >30 days, status still active
4. Abandoned Cart    → cart >7 days old, no order
5. All Aged          → master view, filterable
```

Each tab shows: count badge, oldest-first list, "Worked today" counter.

## Functionality embedded (identical to New Leads)

Re-uses the **same components and hooks** — no duplication:

- Lead detail drawer (notes, history, quotes, call logs, reminders, tags)
- Click-to-dial (Zoiper extension injection)
- Quick notes + structured notes
- Reminder creation (callback scheduling)
- Quote generation + resend
- Status changes (with terminal-status guard: Lost/Converted/Fake Lead removed from queue immediately)
- Tag assignment
- Lead version history / changelog
- Send quote email / SMS
- Mark as Revived → flows back into normal pipeline
- Suspicious lead flag

## Recovery-specific additions

- **"Last touched" column** — days since last call/note/status change (red >60, amber 30–60)
- **"Worked" button** — single click to log "Recovery attempt" activity + auto-advance to next lead
- **Outcome dropdown** on each lead: *Revived · Still trying · No answer · Mark lost · Not interested*
- **Daily target counter** at top: "X of Y worked today"
- **Filter chips**: by previous agent, by source, by quote value, by vehicle age
- **Bulk archive** for clearly-dead leads (with confirm + audit log)

## Permissions

- New role permission: `tab_lead_recovery_view` / `_edit` / `_export`
- Recovery agent gets ONLY this tab + the shared lead detail drawer
- They do NOT see the live New Leads queue (protects Team Red)
- Sales Manager + Admin see it by default

## Data — no new tables

Reads `sales_leads` with filters. Writes use the existing tables agents already touch:
`lead_call_logs`, `lead_quick_notes`, `lead_reminders`, `lead_activities`,
`sales_leads_changelog`, `lead_tag_assignments`.

One small addition: a `recovery_worked_at` timestamp column on `sales_leads` so the "Worked today" counter and oldest-first-not-recently-touched ordering work cleanly. (Nullable, no impact on existing flow.)

## Routing & navigation

- New sidebar item **"Lead Recovery"** under the Sales group, below New Leads
- Route: `?tab=lead-recovery`
- Icon: `RotateCcw` (re-engagement metaphor)

## Build order

1. **Migration** — add `recovery_worked_at` column + permission keys
2. **Page shell** — `LeadRecoveryTab.tsx` with 5 segment tabs, oldest-first queries
3. **Re-use** existing `LeadDetailDrawer` and all hooks (`useLeadCallTracking`, `useLeadReminders`, `useLeadQuotes`, etc.) — zero copy-paste
4. **Recovery toolbar** — Worked button, outcome dropdown, daily counter
5. **Sidebar entry** + permission gating in `AdminSidebar.tsx` and `AdminDashboard.tsx`
6. **Seed first agent** — you assign them the role in User Permissions; no team membership needed (Lead Recovery is separate from Red/Blue lead distribution)

## Guarantees

- Zero changes to `NewLeadsTab`, Team Red routing, distribution settings, or live triggers
- New column is nullable with default null — existing inserts unaffected
- Permission key is opt-in — existing agents see nothing new until granted
