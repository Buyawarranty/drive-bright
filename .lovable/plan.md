# Database resource exhaustion — measured findings and optimization plan

All numbers below come from live reads of this project's `pg_stat_statements` ranking (via the slow-query tool), `pg_stat_user_tables`, `pg_stat_user_indexes`, `pg_policies`, `pg_stat_activity` and `EXPLAIN (ANALYZE, BUFFERS)`.

## Headline: this is a request-volume problem, not a missing-index problem

The single most expensive statement is the New Leads / Quotes & Orders lead read:

- `sales_leads WHERE assigned_to = $1 AND is_paid = $2 ORDER BY assigned_at DESC` — **988,480 calls**, mean 45ms, **12.5 hours of total DB time**
- The same shape with a wider column list — 191,859 calls, mean 170ms, 9.1 hours
- A third near-identical variant — 170,334 calls, mean 182ms, 8.6 hours
- `claims_submissions` email/reg `ilike` lookup — **766,070 calls**, mean 38ms, 8.1 hours

Run in isolation, that top query executes in **0.44ms** using `idx_sales_leads_agent_unpaid_assigned_at`. It is not scanning. It is 100x slower in production purely because the CRM fires it hundreds of thousands of times, and the instance is CPU-saturated by its own polling. `sales_leads` has 19,759 rows but **8.6M index scans and 1.15M sequential scans**; `lead_quick_notes` 9.4M scans; `triggered_emails_log` 12M scans.

So the ranked fixes below are dominated by "call it less", not "index it".

## Confirmed secondary findings

**1. `sales_leads` is over-indexed and over-triggered (19,759 rows).**
53 indexes (29MB of index on a 38MB table), 11 of them never scanned, and **31 non-internal triggers** on the table. Planning alone touches 1,141 buffers / 3.7ms — more than execution. Every lead insert or status change fires 31 trigger functions and maintains 53 indexes.

**2. `sales_leads_changelog` is the disk hog: 1,965MB (1,509MB heap + 457MB indexes) for 710,206 rows** — ~2.8KB per row, i.e. full JSONB row snapshots. It carries 48,336 dead tuples, has **never been manually vacuumed**, and its last autoanalyze was 2026-08-05. The batched read `WHERE lead_id = ANY($1)` runs at **mean 2,224ms / max 8s** (3,565 calls, 2.2 hours) despite `idx_changelog_lead_id` existing — the cost is heap/TOAST fetches, not the index.

**3. Cross-table client fan-out (N+1).**
`sales_leads` email/name/phone/reg 16-way `ilike` search: mean 1,150ms and 1,198ms, 3.1 + 2.8 hours. `customers.registration_plate ilike` fires **104,606 times** (1.7 hours). The changelog `IN (...)` batch is fired per lead page render.

**4. RLS is already correct — not the current cause.**
Every policy on `sales_leads`, `claims_submissions`, `customers`, `lead_quick_notes`, `sales_leads_changelog` already wraps `(SELECT auth.uid())`, and `is_active_admin_user` / `is_admin` / `has_tab_access` are all `STABLE SECURITY DEFINER`. The previously-diagnosed RLS regression is fixed; do not re-litigate it.

**5. Connections are not the cap.** 40 of `max_connections` 60 in use, but **30 are idle and the oldest idle session is 38 days old** — leaked/parked sessions eating a third of the pool. Only 2 active.

**6. Realtime is broad.** 18 tables in `supabase_realtime`, including `sales_leads`, `abandoned_carts`, `page_views`-adjacent activity tables and `user_presence`. Every lead write is broadcast to every subscribed CRM tab.

**7. Storage/egress is not the problem.** 656MB in `policy-documents`; every other bucket is under 2MB. Database size is **3,557MB**, of which `sales_leads_changelog` (1,965MB), `user_activity_log` (273MB), `page_views` (202MB) and `email_logs` (144MB) are 72%.

**8. 439 unused indexes project-wide, 178MB** — pure write and vacuum overhead.

## Which resource is closest to its cap

- **Compute/CPU — the binding constraint.** Millions of small reads, mean latency inflated 100x over isolated execution, max latencies of 5–8s across every top query.
- **Disk — second.** 3.5GB, ~55% of it one audit table that grows on every lead write.
- **Connections — a soft risk.** 40/60 with 30 idle leaks.
- **Egress/storage — comfortable.** No action needed.

## Fix plan, ranked by impact vs effort

### Tier 1 — kill the polling (largest win, frontend only, no migration)

1. **Stop re-polling the lead list.** The 988k + 192k + 170k calls are three near-identical variants of one screen's read. Consolidate them into one query shape behind a single cached fetch (React Query with a real `staleTime`, plus the existing realtime channel for invalidation) instead of interval refetches. Expected: 30+ hours of DB time removed, ~55% of measured total load.
2. **Debounce the `claims_submissions` lookup (766k calls).** It is fired per customer row; batch it into one `.in()` per page — the pattern already documented in project memory. Expected: ~8 hours removed.
3. **Debounce the `customers.registration_plate` check (104k calls)** on quote/reg entry — client-side debounce plus caching of the last result.
4. **Server-side search instead of 16-way `ilike`.** Route lead search through one RPC using the existing trigram indexes and `right(normalize_uk_phone(phone),9)`, returning a capped result set. Expected: ~6 hours removed and the 1.2s mean gone.

### Tier 2 — trim the write path (migration required, low risk)

5. **Drop the 11 never-scanned indexes on `sales_leads`** and audit the 439 unused project-wide (178MB). Cuts insert cost and planning buffers.
6. **Audit the 31 triggers on `sales_leads`.** Several are ORR-era or one-off backfills; consolidate the assignment/ORR family into fewer functions. Needs a per-trigger review before removal since lead routing depends on them.
7. **Shrink `sales_leads_changelog`.** Stop storing the full row snapshot on every change (store changed fields only), add a retention window (e.g. 180 days) with a scheduled purge, then `VACUUM (FULL, ANALYZE)` to reclaim the ~1.9GB. Biggest disk and I/O win.
8. **Trim retention on `user_activity_log` (273MB), `page_views` (202MB), `email_logs` (144MB), `ghl_sync_log` (48MB).**

### Tier 3 — hygiene

9. **Narrow realtime.** Remove high-churn/low-value tables from `supabase_realtime`; keep `sales_leads`, `customer_notifications`, alert tables. Ensure every `supabase.channel` is torn down in a `useEffect` cleanup.
10. **Fix the leaked idle connections** (38-day-old session): add an idle timeout and confirm no long-lived client outside the pooler.
11. **Schedule regular ANALYZE** on `sales_leads_changelog`, `user_activity_log`, `page_views` — several have never had a manual vacuum/analyze.

### Explicitly not needed

No new index on `sales_leads` (the correct partial indexes exist and are used), no RLS rewrite, no storage/egress work, no pooler upgrade.

## Suggested execution order

Tier 1 items 1–4 first, in that order, measuring the slow-query ranking after each. Then Tier 2 item 7 (changelog) because it dominates disk. Trigger consolidation (item 6) last, as its own reviewed change.
