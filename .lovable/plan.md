

## Problem Analysis

You have **90 leads** in the backup/recovery tab (which reads from `abandoned_carts` + `sales_leads`) but only **63 in New Leads** (which reads from `sales_leads` only). That means **~27 abandoned carts never got a corresponding `sales_lead` record created**.

### Why leads are getting lost

The `auto_create_lead_from_abandoned_cart()` trigger fires on `INSERT OR UPDATE` of `abandoned_carts`. But if:

1. The `get_next_sales_user()` function throws an error (e.g., no agents configured, cap table issue)
2. The INSERT into `sales_leads` hits a constraint violation
3. The trigger silently fails for any reason (Postgres swallows errors in AFTER triggers)

...the `abandoned_cart` record is saved successfully, but **no `sales_lead` is ever created**. The lead is captured in the backup tab but invisible to the sales team.

### Why "Recover" doesn't help

The current "Recover" button only syncs contacts to the `marketing_audience` table. It does **not** create missing `sales_leads` records. There is no mechanism to detect or fill the gap between `abandoned_carts` and `sales_leads`.

---

## Plan

### 1. Create a database function: `recover_orphaned_leads()`

A new SQL function that:
- Finds all `abandoned_carts` records that have an email, `step_abandoned >= 2`, are NOT `is_converted`, and do NOT have a matching `sales_lead` (by `abandoned_cart_id` OR email within 7 days)
- Skips any where a terminal-status lead already exists for that email/phone
- Creates the missing `sales_lead` for each orphan, using the same field mapping as the trigger
- Assigns via `get_next_sales_user()` round-robin
- Returns a count of recovered leads
- This function is **idempotent** — running it multiple times won't create duplicates

### 2. Create an edge function: `auto-recover-leads`

A lightweight scheduled edge function that:
- Calls `recover_orphaned_leads()` RPC
- Logs the result (how many recovered)
- Runs every hour via `pg_cron`
- Uses the service role key so it bypasses RLS

### 3. Schedule the hourly cron job

A `pg_cron` job that calls the `auto-recover-leads` edge function every hour automatically — no manual clicking required.

### 4. Add a "Recover to Sales" button to the Backup tab

Update `LeadBackupRecoveryTab.tsx` to:
- Show a new stat card: "Missing from Sales Leads" (abandoned carts without a matching sales_lead)
- Add a "Recover to Sales" button that calls `recover_orphaned_leads()` for on-demand recovery
- Show an amber alert when orphaned leads are detected
- Display a "Last auto-recovery" timestamp so admins know the hourly job is running

### 5. Add a safety net trigger on `abandoned_carts`

Enhance the existing trigger to wrap the `sales_leads` INSERT in an exception handler. If the INSERT fails for any reason, log the error to `system_event_logs` instead of silently failing. This provides forensic visibility into WHY leads are being lost.

---

### What this does NOT change
- The existing website flow (Step 1-4) is untouched
- The existing `auto_create_lead_from_abandoned_cart` trigger logic stays the same
- The existing New Leads tab, lead distribution, and all admin dashboard functionality remain identical
- The marketing sync / backup recovery continues to work as before
- The recovery function only creates leads that are genuinely missing — no duplicates

### Technical detail

```text
abandoned_carts ──[trigger]──> sales_leads    (existing, sometimes fails silently)
                                    │
                                    ▼
                           New Leads Dashboard

abandoned_carts ──[hourly cron]──> recover_orphaned_leads()  (NEW safety net)
                                    │
                                    ▼
                           Creates missing sales_leads
```

