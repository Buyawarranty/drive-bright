---
name: Open Pool + round-robin ownership rules
description: Strict rules for what qualifies as an Open Pool lead, when an agent takes ownership, and how round-robin / auto-distribute works
type: feature
---
**Open Pool (`queue = 'live_open_pool'`) contains ONE thing only:** leads with `status = 'new'`, `owner_agent IS NULL`, `assigned_to IS NULL` — genuinely never spoken to.

**Ownership transfer:** The instant an agent moves a lead past `new` (to `contacted`, `quote_sent`, `follow_up`, `negotiating`, `urgent_callback`), that agent owns it. `owner_agent` gets stamped, `queue` becomes `owned_by_agent` (or `retry_queue` if there's a call-window timer). It **never** returns to the Open Pool.

**Terminal:** `lost`, `converted`, `fake_lead` never re-pool (per existing terminal-status-no-resurrection rule).

**Round-robin / auto-distribute:**
- Only picks `status = 'new'` leads from `live_open_pool`.
- Respects each agent's `daily_cap` from `agent_distribution_caps` (assigned_today vs cap).
- One lead → one agent (locked via `FOR UPDATE SKIP LOCKED` inside `open_pool_bulk_assign_to_agent`).
- Stamps `assigned_at`, `last_resubmitted_at`, sets `queue` to `owned_by_agent` (no timer) or `retry_queue` (with timer).

**Agent capacity cards in the banner:**
- Each chip shows: mode dot · agent name · assigned today / daily cap · remaining capacity.
- `assigned_today` must be calculated live from `sales_leads` using `assigned_at >= today UTC`, not from the `agent_distribution_caps.assigned_today` counter (which is stale and misses re-allocations).

**UI copy rule:** Banners must say "never-contacted leads" — never "recycled" or "new pool leads" ambiguously. The pool by definition is never-spoken-to.

**Enforced in:**
- RPC `public.open_pool_bulk_assign_to_agent` (WHERE `status = 'new'`)
- `src/components/admin/leads/OpenPoolBacklogBanner.tsx` (`loadCount` / `loadRows` both `.eq('status','new')`)
