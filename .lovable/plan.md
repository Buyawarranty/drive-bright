
# Goldmine Leads — assignment + UX

## 1. Rename
- Sidebar label: **Goldmine Leads** (icon: Gem)
- Tab ID stays `golden-leads` internally to avoid breaking saved bookmarks; URL `?tab=goldmine-leads` added as an alias.
- Update all visible copy ("Lead Recovery" / "Golden Leads" → "Goldmine Leads").

## 2. Structure — one sidebar entry, two sub-tabs
Best when multiple salespeople work the list together: keeps the sidebar tidy and lets agents flip between the two pipelines without losing context.

```
Goldmine Leads
 ├─ Goldmine        (abandoned-cart / recovery customers)
 └─ Renewals        (policies approaching expiry)
```

Each sub-tab is its own list with the same toolbar (search, filter, assign).

## 3. Agent assignment — round-robin + override
- New column **Assigned Agent** on each row, with an inline dropdown (sales agents only).
- On new Goldmine / Renewal record creation, an `assign_goldmine_lead` trigger picks the next active sales agent from `agent_distribution_caps` using the existing round-robin pattern (same logic as Live Leads).
- Manager / Admin / Super Admin can reassign any row at any time. Agents can only see, not reassign.
- Bulk action: select rows → **Assign to…** (manager/admin only).
- Every assignment change writes to `lead_assignment_audit` so the trail is preserved.

## 4. Visibility — built for motivation, not silos
Goldmine is high-value, so we want healthy competition rather than hidden queues:

- Everyone on the sales team sees **the full list**.
- Each row badges the assigned agent (color from the existing agent identity map).
- Top of page: **leaderboard strip** — per-agent count of "Worked today / Converted today / Conversion %" for the active sub-tab. Refreshes every 30s.
- Toggle **"My leads only"** for focused-work mode (off by default).
- Agents can still only *edit / call / note* their own assigned rows; viewing others is read-only. Manager+ can edit any.

## 5. Sales process — recommended workflow
1. Lead lands in Goldmine or Renewals → auto-assigned via round-robin → toast + sidebar badge for that agent.
2. Agent opens the row → sees customer history, last quote, abandoned cart contents, previous notes.
3. Standard status flow: `new → contacted → quoted → converted | lost`. Reusing the Live Leads status enum keeps reporting consistent.
4. Conversion writes back to `customers` (Goldmine) or extends `customer_policies` (Renewals); row drops out of the active list and into the leaderboard's "Converted" count.

## Technical notes
- Frontend: rename in `AdminSidebar.tsx`, `AdminDashboard.tsx`; rebuild `GoldenLeadsTab` as `GoldmineLeadsTab` wrapping two child tabs (`GoldmineList`, `RenewalsList`) that share a `GoldmineLeadsTable` component (columns, assignment dropdown, leaderboard strip).
- Backend: add `assigned_agent_id` columns where missing on the source views, plus a postgres function `assign_next_goldmine_agent()` mirroring the live-leads round-robin. RLS: sales role → SELECT all, UPDATE only `WHERE assigned_agent_id = auth.uid()`; manager+ → full.
- Leaderboard powered by a lightweight `goldmine_agent_stats` view aggregating today's activity per agent.

## Out of scope (ask if you want it)
- SMS/email cadence automation specific to Goldmine
- Separate commission rates for Goldmine vs Live Leads
- Self-claim ("grab next lead") button instead of round-robin
