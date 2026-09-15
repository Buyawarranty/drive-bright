---
name: RLS policies must wrap auth.uid()
description: Every RLS policy must use (SELECT auth.uid()) not bare auth.uid(); bare calls re-evaluate per row and were the recurring cause of Quotes & Orders / New Leads timing out for sales staff
type: preference
---

Root cause of the repeated "Quotes & Orders and New Leads won't load for sales agents" outages:
RLS policies calling `auth.uid()` / `auth.jwt()` / `auth.role()` directly. Postgres treats
those as volatile per-row calls, so a query over `sales_leads_changelog` (635k rows) ran
hundreds of thousands of auth lookups. Mean query time climbed to 50–2100ms and the whole
CRM contended on CPU (~2M calls/day across the dashboard).

Sep 2026: all 622 public policies were swept and every `auth.uid()/jwt()/role()` is now wrapped
as `( SELECT auth.uid() )` (including ones passed as function args, e.g.
`can_manage_lead_routing(( SELECT auth.uid() ))`). Keep it that way — 0 bare calls is the baseline.

Rules:
- ALWAYS write `(SELECT auth.uid())` inside policy USING/WITH CHECK expressions.
- Never write a correlated `EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.id = <table>.col)`.
  Use `col = ANY (ARRAY(SELECT au.id FROM admin_users au WHERE au.user_id = (SELECT auth.uid()) AND au.is_active))`
  so the agent lookup becomes a once-per-query InitPlan.
- When a dashboard page is "slow again", check `pg_policies` for bare `auth.*()` before
  adding indexes — the plans on these tables are already sub-millisecond when idle.

Frontend companion rule: never issue one query per table row (the customers grid used to
fire one `claims_submissions` ilike per row). Coalesce row-level lookups into one batched
`.in()` read per page.
