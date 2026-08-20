---
name: Save Cancellation Rescue Leads
description: Admin/super_admin send a cancelling customer back into New Leads as an unassigned urgent "save the deal" lead with a £15 reward
type: feature
---

Where it is sent from: **Cancellations tab** — each row has a "Save this deal" button, visible only to admin/super_admin (isFinancialRole).

What it creates in `sales_leads`:
- `save_cancellation = true`, `save_reward_amount` (default **£15**, editable), `save_reason` (manager message), `save_requested_by`, `save_requested_at`, `save_source_customer_id`
- `status = 'urgent_callback'`, `priority = 'urgent'`, `manual_entry = true`, `assigned_to = NULL`

Rules:
- These leads are deliberately **unassigned** so any agent can take them — triggers `trg_auto_assign_lead` and `trg_orr_offer_on_intake` skip rows where `save_cancellation = true`.
- They must be **phoned**, not emailed; the note states this.
- New Leads shows a `SaveCancellationBadge` ("SAVE CANCELLATION · £15") on desktop rows and mobile cards.
