---
name: Open Pool leads are recycled, not new
description: Never describe Open Pool / bulk-assigned leads as "new" or "brand-new" — they are recycled/unclaimed leads from previous assignments
type: constraint
---
The `live_open_pool` queue contains RECYCLED leads — leads that were previously assigned, went un-worked, timed out, or were released back. Their `created_at` can be days or weeks old.

**Never** describe these as "new leads", "brand-new leads", or "fresh leads" in UI copy, banners, assistant replies, or system notes. Always use accurate wording:

- "Unclaimed pool leads"
- "Recycled Open Pool leads"
- "Leads waiting in the Open Pool (may be days old)"
- "Re-surfaced leads"

**Why:** Sales agents and managers rely on lead age to prioritise. Calling a 4-day-old lead "new" wastes their time and destroys trust in the tool. The user has explicitly called this out.

**How to apply:** Any auto-distribute, bulk-assign, sweep, banner, toast, or RPC log_desc that touches `live_open_pool` or `open_pool_bulk_assign_to_agent` must use recycled/unclaimed phrasing — never "new".
