# Master Allocation — unified page

Replace the two-tab "Allocation" / "Lead Routing" UI with **one** page called **Master Allocation**, visible only to `admin`, `super_admin`, `sales_manager`. Everything needed to control where leads go and who works them lives in one scroll.

## Page layout (top → bottom)

1. **Master switch bar** — `Team routing` ON/OFF (same safety toggle as today). When OFF, banner says "Legacy global flow active — team rules below are previewed only."
2. **Routing tester** — unchanged dry-run tool.
3. **Source → Team split matrix** (the new bit, replaces the on/off lever grid)
   - Rows = sources (Google Ads, Facebook Ads, Instagram, TikTok, YouTube, Organic, Direct, Referral, Email, SMS, Other).
   - Columns = each team (Red, Blue, Green, …).
   - Each cell holds a **percentage number input (0–100)** instead of a toggle. 0 = team doesn't receive that source. The row shows a live total badge: green when = 100, amber when < 100 (remainder falls back to legacy flow), red when > 100 (blocked from saving).
   - "Even split" button per row to auto-distribute across teams with members.
   - "Copy from…" per row to clone another source's split.
   - Saved into `lead_team_source_rules` (extend with `percentage int`, keep `allowed` for back-compat — `allowed = percentage > 0`).
4. **Team allocation panels** — one card per team (Red / Blue / Green), same agent table you have today (NEW / RECONTACT / RENEWALS toggles, Move to…, Remove). Pending sales agents card stays at the top of this section.
5. **Per-team agent weighting (inside each team card)** — small "Share %" column next to each agent so a team lead can weight who gets more of that team's leads. Defaults to even. Stored in `agent_distribution_caps.percentage` (already exists).

## Routing decision (server side)
For each new lead:
1. If master switch OFF → legacy flow.
2. Pick source. Look up rows in `lead_team_source_rules` where `percentage > 0` and team has ≥1 active member.
3. Weighted random by team percentage. If chosen team's percentage total < 100, the remaining % falls through to legacy flow.
4. Inside the team, weighted round-robin across active agents using `agent_distribution_caps.percentage` (skip paused).

## Files to change
- `src/components/admin/leads/AgentsLeadsView.tsx` — collapse two tabs into one stacked layout.
- `src/components/admin/leads/LeadRoutingMatrix.tsx` (or current routing component) — swap toggle cells for % inputs + row totals + Even/Copy buttons.
- Allocation card component — add per-agent "Share %" input.
- Edge function / RPC that assigns leads — switch from boolean `allowed` to weighted pick using `percentage`.

## Migration
- `ALTER TABLE lead_team_source_rules ADD COLUMN percentage int NOT NULL DEFAULT 0;`
- Backfill: existing rows with `allowed = true` → `percentage = 100 / (# allowed teams for that source)` (even split of current ON teams).
- Keep `allowed` as a generated/maintained mirror (`allowed = percentage > 0`) so nothing else breaks.

## What this fixes
- One page, no tab hunting.
- Explicit % control answers "how much of Facebook goes to Red vs Blue".
- Per-agent share inside a team answers "Kevin should get 70% of Blue's leads while we ramp him".
- Role-gated to manager/admin/super_admin so sales agents still see only their own queue.

Confirm and I'll build it (migration + UI + assignment logic).