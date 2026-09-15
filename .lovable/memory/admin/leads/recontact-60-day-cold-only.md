---
name: Recontact pool = 60 days old AND 60 days uncontacted
description: Recontact claiming/bulk-assign must exclude leads with any call log or note in the last 60 days, matching the available counter
type: feature
---
A lead is only eligible for recontact when BOTH are true:
- created more than 60 days ago, and
- no `lead_call_logs` entry and no `lead_quick_notes` entry in the last 60 days.

Applies identically to `claim_recontact_leads_batch`, `assign_recontact_leads_to_agent` and
`count_recontact_leads_available` (available count, pool_remaining, oldest age) so the number
shown always equals what agents receive. Ordering stays `created_at DESC` (newest-first).

Note: `lead_call_logs.lead_id` is TEXT (can hold `cart_<uuid>` values) — always compare with
`sl.id::text`, never cast the column to uuid.
