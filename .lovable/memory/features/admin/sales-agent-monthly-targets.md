---
name: Sales Agent Monthly Targets
description: Management-only tab setting per-agent monthly revenue targets (default £35,000) that show only on the agent's own scoreboard
type: feature
---
- Admin tab `sales-agent-targets` ("Sales Agent Monthly Targets"), management only (admin, super_admin, sales_manager, performance_manager).
- Stored on `sales_targets.revenue_target` (numeric, default 35000) for the current month row (`target_period = 'monthly'`).
- Default target for every agent = £35,000/month.
- Scoreboard shows the revenue target banner for the signed-in agent's OWN record only — never other agents' targets.
- `sales_targets` has a select policy letting an agent read their own row (matched via `admin_users.user_id = auth.uid()`).
