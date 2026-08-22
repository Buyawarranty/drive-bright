---
name: No automatic lead pause
description: Lead pausing/freezing is manual only — managers pause and resume agents from Lead Allocation; nothing freezes on sales performance
type: constraint
---

Automatic lead freezing is removed and must never come back.

- `evaluate_agent_lead_freeze()` is a deliberate no-op; `agent_distribution_caps.auto_freeze_enabled` defaults to false.
- No "1 sale or fewer over N service days" rule, no pro-rata exemption logic, no freeze cron.
- Pausing an agent's leads is a manual manager action in Lead Allocation ("Leads on / off").
- UI may still show "Leads paused" when a manager has paused someone — never an automatic reason.

**Why:** managers control allocation; on-target agents (e.g. James) were being frozen wrongly.
