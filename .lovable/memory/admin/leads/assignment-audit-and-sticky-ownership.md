---
name: Assignment audit trail & sticky worked-lead ownership
description: Every lead owner change is logged to lead_assignment_audit; worked leads (note, call log, Zoiper/Dial 9 event, or status moved off new) stay with their agent unless a manager reassigns
type: feature
---
- `audit_lead_assignment_change()` (trigger `trg_zz_audit_lead_assignment` on `sales_leads`) records EVERY owner change — manual, manager, automatic, and blocked attempts — into `lead_assignment_audit` with `previous_assigned_to_id`, `changed_by_user_id`, `assignment_type`, `reason`, `was_worked`.
- `lead_has_human_activity()` counts a lead as worked if there is: a quick note, a `lead_call_logs` row, a `phone_events` row with an agent (Zoiper / Dial 9), call_count/manual adjustment > 0, `last_contacted_at`, notes text, or status is anything other than `new`.
- Worked or owned leads can only change owner via a manager reassignment (`can_manage_lead_routing`) or the explicit recovery bypass. Automation must never take them.
- The cosmetic "Default Lead Allocation" panel was deleted from AllocationMatrix — do not re-add it.
