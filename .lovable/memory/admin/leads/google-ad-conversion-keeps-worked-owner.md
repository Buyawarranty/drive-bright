---
name: Google Ad conversions keep the worked agent
description: Converted google_ad leads only go back to "Website" if never worked; any call/note/manual assign keeps the agent as owner forever
type: feature
---

`auto_reassign_google_ad_conversion` must NOT clear `assigned_to` when the lead was worked.

Worked = any of: `call_count > 0`, `manual_call_adjustment > 0`, `last_contacted_at` set, notes present, a row in `lead_call_logs` / `lead_quick_notes` / `phone_events` (with agent), or a `lead_assignment_audit` row of type manager_manual_assign / manual_assign / bulk_reassign. Deliberately does NOT count "status <> new", because conversion itself changes status.

Only untouched self-serve Google Ads conversions become unassigned ("Website").

Recovery of wrongly cleared owners must run with `set_config('app.allow_reassign','on',true)` in the same transaction, otherwise `protect_worked_lead_assignment` / `trg_protect_touched_leads` revert `assigned_to` back to the (null) OLD value. Restore order: latest `lead_assignment_audit.assigned_to_id`, else latest `lead_call_logs.agent_id` (must be a sales/sales_lead admin user).
