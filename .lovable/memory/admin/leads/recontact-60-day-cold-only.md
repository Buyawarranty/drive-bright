---
name: Recontact pool = 60 days old AND 60 days no activity (assignment ignored)
description: Recontact claiming/bulk-assign includes previously assigned leads; only age >60d and no call/note in last 60d matter, newest-first
type: feature
---
A lead is eligible for recontact when BOTH are true:
- created more than 60 days ago, and
- no `lead_call_logs` entry and no `lead_quick_notes` entry in the last 60 days.

Current assignment is IRRELEVANT — previously assigned but unworked leads ARE part of the pool
and get reassigned to the claiming agent. The only assignment exclusion is leads already sitting
with the claiming/target agent themselves. Never re-add an `assigned_to IS NULL` filter.

Applies identically to `claim_recontact_leads_batch`, `assign_recontact_leads_to_agent` and
`count_recontact_leads_available` (available count, pool_remaining, oldest age) so the number
shown always equals what agents receive. Ordering stays `created_at DESC` (newest-first).

Note: `lead_call_logs.lead_id` is TEXT (can hold `cart_<uuid>` values) — always compare with
`sl.id::text`, never cast the column to uuid.
