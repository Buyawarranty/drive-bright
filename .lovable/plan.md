## Goal
One place — the **Lead Teams** page — where managers and admins allocate agents across **New Leads**, **Recontact Leads** and **Renewals**, with an agent able to work multiple workstreams at the same time (e.g. New Leads + Renewals).

## Concept

Today: `lead_team_members` ties an agent to one team. That team feeds the New Leads queue only.

New model — add a **workstream** dimension on top of team membership:

```
Workstreams: new_leads | recontact | renewals
```

Each agent's membership row is augmented with which workstreams they're active on. Teams stay as the colour grouping (Red/Blue/Green). Workstreams say what work the agent picks up.

```
              New Leads  Recontact  Renewals
Team Red
  James R.       ✓          ✓          ·
  Thomas         ✓          ·          ·
Team Blue
  Kevin          ✓          ✓          ✓
  Ash            ·          ·          ✓
```

A manager can toggle any cell in one click. Agents not yet in a team show in the existing "Pending" card and get placed into a team + workstreams in the same step.

## Lead Teams page — UI

A single tab strip at the top of the page switches the **filter** view (All / New Leads / Recontact / Renewals). The default "All" view shows the matrix above. Each workstream view shows just that column expanded with extra context (queue size, today's allocations, agents online).

Per-agent row controls:
- Three subtle toggle chips: **New** / **Recontact** / **Renewals** — coloured when on, faded when off
- "Move to…" dropdown (existing) for team switching
- Remove button (existing)

Bulk actions (per team):
- "Enable all on New Leads", "Enable all on Renewals" etc. — for fast setup
- "Copy from Team Red" — to mirror another team's workstream layout

Anywhere an agent's workstream changes, the existing `team_changed_at` notice mechanism extends so the agent gets a polite one-time popup on next login: *"You've been added to Renewals. Please contact your performance manager for more details."*

## Where the workstream selection is enforced

- **New Leads** distribution: only assigns to agents where `new_leads = true`
- **Recontact Leads** (`LeadRecoveryTab`): the agent filter and any auto-allocation only consider agents where `recontact = true`
- **Renewals** (`RetentionTab`): same, gated by `renewals = true`

Default for backwards compatibility: every existing `lead_team_members` row is migrated with `new_leads = true`, others `false`. Nothing changes for current users until a manager flips a switch.

## Access

Same gating as today: super_admin, admin, sales_manager can edit. sales_lead view-only on their own team. Everyone else can't see the page.

---

## Technical detail

**Schema (migration)**

```sql
ALTER TABLE public.lead_team_members
  ADD COLUMN workstream_new_leads boolean NOT NULL DEFAULT true,
  ADD COLUMN workstream_recontact boolean NOT NULL DEFAULT false,
  ADD COLUMN workstream_renewals  boolean NOT NULL DEFAULT false;
```

Backfill existing members so behaviour is unchanged on day one. Existing RLS already covers the table.

**Files**

- `src/components/admin/leads/LeadRoutingDialog.tsx` (now `LeadRoutingPanel`): add the workstream toggles on each member row, a workstream column in the cross-team glance, and bulk actions per team.
- `src/components/admin/LeadTeamsTab.tsx`: add the All / New / Recontact / Renewals tab strip.
- `src/hooks/useAgentTeams.ts`: also expose `workstreams` per agent so other tabs can filter by them.
- `src/components/admin/leads/LeadRecoveryTab.tsx` and `src/components/admin/retention/RetentionTab.tsx`: filter their agent dropdowns / auto-assign helpers to agents where the relevant workstream flag is true.
- `src/components/admin/leads/TeamChangeNoticeDialog.tsx`: extend message to mention workstream additions (uses same `team_changed_at` / `notice_seen_at` already in place).

**Out of scope for this change**
- Reworking the actual round-robin distribution engine. The workstream flags simply restrict the agent pool that each engine already uses; we don't change the algorithm.
- Per-source rules per workstream (the existing `lead_team_source_rules` stay scoped to New Leads routing).
