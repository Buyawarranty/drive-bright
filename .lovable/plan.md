## Goal
Every step 2 submission keeps landing in the admin dashboard (`sales_leads` via `track-abandoned-cart`) **and** is also pushed to GoHighLevel — with no blocking and an automatic retry on failure.

## Recommended connection method
Use a **GHL Inbound Webhook URL** (created in a GHL Workflow → trigger "Inbound Webhook"). Reasons:
- No OAuth, no Location ID, no token expiry.
- One secret to store: `GHL_WEBHOOK_URL`.
- GHL workflow on their side can map fields → create/update Contact → tag → start nurture. Easy for non-devs to tweak later without code changes.
- Works perfectly with fire-and-forget + retry queue.

(If later you want full API control — contact upserts, opportunities, custom fields by ID — we can swap to the API method without touching the frontend.)

## Architecture

```text
Step 2 submit
   │
   ▼
track-abandoned-cart  ──►  sales_leads (admin dashboard)  ✅ existing
   │
   └──►  push-to-ghl  (fire-and-forget, awaited 0ms)
              │
              ├── POST GHL webhook  ──► success → done
              │
              └── on failure / non-2xx
                       │
                       ▼
                ghl_push_queue (retry row)
                       │
                       ▼
              cron every 5 min → retry-ghl-pushes (max 5 attempts, exp backoff)
```

## Steps

1. **Add secret** `GHL_WEBHOOK_URL` (user pastes the Inbound Webhook URL from their GHL workflow).

2. **Migration** — create `ghl_push_queue`:
   - `payload jsonb`, `status` (pending / sent / failed), `attempts int`, `last_error text`, `next_attempt_at timestamptz`, `sent_at timestamptz`.
   - RLS: service-role only (no client access). Index on `(status, next_attempt_at)`.

3. **New edge function `push-to-ghl`**:
   - Input: normalized lead payload (name, email, phone, address, vehicle reg/make/model/year/mileage, step, source, fbclid/gclid, plan info).
   - POST to `GHL_WEBHOOK_URL` with `AbortSignal.timeout(4000)`.
   - On non-2xx or network error → insert into `ghl_push_queue` with `next_attempt_at = now() + 1 min`. Never throws upward.
   - `verify_jwt = false`, internal-only (called from other edge functions).

4. **Wire it into `track-abandoned-cart`**:
   - After the existing `sales_leads` upsert succeeds, call `push-to-ghl` via `EdgeRuntime.waitUntil(...)` so the user response is unaffected.
   - No try/catch impact on the main flow — GHL failures never block lead saving.

5. **New edge function `retry-ghl-pushes`** + pg_cron job (every 5 min):
   - Select up to 50 rows where `status='pending' AND next_attempt_at <= now() AND attempts < 5`.
   - Re-POST each. On success mark `sent`. On failure bump `attempts`, set `next_attempt_at = now() + (2^attempts) minutes`, store `last_error`. After 5 attempts mark `failed`.

6. **Admin visibility (small)**:
   - Add a tiny "GHL sync" badge column logic later if you want — out of scope for this task; the queue table is enough for diagnostics via SQL.

## Field mapping sent to GHL
```text
firstName, lastName, email, phone, address1, city, postalCode,
customField.vehicle_reg, vehicle_make, vehicle_model, vehicle_year, mileage,
customField.step_abandoned, source ("buyawarranty - step 2"),
customField.fbclid, gclid, plan_name, total_price
```

## What does NOT change
- Step 2 frontend code is untouched.
- `sales_leads` saving, round-robin assignment, abandoned cart emails, SMS, WhatsApp, FB CAPI, Google offline conversions — all unchanged.
- No new client-side dependencies.

## Risk / rollback
- All new code is additive. Removing the secret immediately disables GHL pushes (function logs a warning and exits). Drop the table + cron to fully remove.
