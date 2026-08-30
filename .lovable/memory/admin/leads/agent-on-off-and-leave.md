---
name: Agents on and off (with leave dates)
description: Lead Teams panel "Agents on and off" — per-agent switch that also revokes login/permissions, plus holiday/leave date ranges that stop new leads for those dates only
type: feature
---
- Panel: `src/components/admin/leads/AgentActiveStatusPanel.tsx`, mounted in `LeadTeamsTab` above `#agent-offboarding`.
- Switch OFF sets `admin_users.is_active = false` → blocks staff login, revokes tab permissions, and the DB trigger pauses their distribution cap and clears workstreams. Nothing is deleted.
- Switched-off / archived agents appear in a "data kept" list with their remaining lead count and a jump to Agent Offboarding for redistribution.
- Leave: table `agent_leave_periods` (admin_user_id, start_date, end_date, leave_type). `agent_on_leave(uuid, date)` is called inside `agent_works_new_leads`, so every distribution path skips an agent while on leave and puts them back automatically afterwards.
