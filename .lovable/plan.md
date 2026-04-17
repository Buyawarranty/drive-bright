

## Diagnosis (no code changes needed yet)

**Round-robin IS working correctly.** Live data:

| Metric (today) | James | Ash |
|---|---|---|
| `sales_leads.assigned_to` | 35 | 35 |
| `agent_distribution_caps.assigned_today` | 42 | 42 |
| Screenshot "Today" column | 37/30 | 36/30 |

7-day breakdown is also balanced (within 5–10 leads per source). The trigger `trg_auto_assign_lead` → `auto_assign_lead_round_robin()` uses strict `sort_order` rotation with cap + pause checks, and it's firing as designed.

## Why it *looks* unequal

The "All Leads" view unions `sales_leads` + `abandoned_carts`. Today there are **78 abandoned carts with `contacted_by = NULL`** (949 over 7 days). Carts have **no auto-assignment trigger** — only `trg_auto_create_lead_from_cart`, which mirrors a cart into `sales_leads` (where it gets round-robin'd) but leaves the original cart row unassigned. So the dashboard shows piles of "Unassigned" rows that are actually already worked via their mirrored lead — making distribution appear broken.

## What I propose to fix (one small migration, no UI changes)

**Option A — recommended: keep cart `contacted_by` in sync with the mirrored lead's `assigned_to`.**

Update the existing `auto_create_lead_from_abandoned_cart()` function so that after it inserts/updates the mirrored `sales_lead`, it writes the same `assigned_to` back to `abandoned_carts.contacted_by`. This way:

- No new trigger, no double round-robin spin
- Carts and leads stay perfectly in sync
- The "Unassigned" pile in the dashboard disappears
- Agents see the cart under their queue instead of orphaned

```text
abandoned_cart INSERT
   └─ trg_auto_create_lead_from_cart
        └─ inserts/updates sales_leads (round-robin assigns agent X)
             └─ writes back: abandoned_carts.contacted_by = X   ← NEW
```

**One-time backfill** for the 949 existing orphaned carts:
```sql
UPDATE abandoned_carts ac
SET contacted_by = sl.assigned_to
FROM sales_leads sl
WHERE ac.contacted_by IS NULL
  AND sl.assigned_to IS NOT NULL
  AND lower(sl.email) = lower(ac.email);
```

## Files / migrations

- 1 migration: update `auto_create_lead_from_abandoned_cart()` + run backfill UPDATE.
- No frontend changes needed — `SalesLeadDashboard.tsx`'s unassigned counter (`!c.contacted_by`) will resolve naturally.

## Out of scope (flag if you want them)

- Adding round-robin **directly** on `abandoned_carts` (would double-assign because mirrored leads also rotate).
- Changing distribution mode logic itself — it's working.

