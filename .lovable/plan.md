
## Goal
Every lead captured on buyawarranty.co.uk should land in GoHighLevel (GHL) in addition to the admin dashboard, and the GHL "Leads" view should mirror the structure, fields, and status flow we use internally.

## Current state
- `push-to-ghl` edge function already exists (upserts a contact via the GHL v2 `/contacts/upsert` API, with a retry queue `ghl_push_queue` + `retry-ghl-pushes` cron worker).
- It is currently only called from `track-abandoned-cart` (Step 2 abandons).
- New full leads (`sales_leads` inserts from Step 1 reg lookup, Step 2 contact, completed checkouts) are NOT pushed to GHL.
- Required secrets: `GHL_API_KEY` (Private Integration token `pit-...`) and `GHL_LOCATION_ID`.

## Part 1 — GoHighLevel setup (done by you in GHL UI)

1. **Create a Private Integration token**
   Settings → Private Integrations → Create. Scopes needed:
   - `contacts.write`, `contacts.readonly`
   - `opportunities.write`, `opportunities.readonly`
   - `locations/customFields.write`, `locations/customFields.readonly`
   - `locations/tags.write`
   Copy the `pit-...` token and the Location ID (Settings → Business Profile).

2. **Create a Pipeline that mirrors our lead lifecycle**
   Pipelines → New Pipeline → name it **"Website Leads"** with stages matching our internal statuses:
   `New → Contacted → Quoted → Callback → Negotiating → Converted → Lost → Fake Lead`
   (these match the values in `sales_leads.status`).

3. **Create Custom Fields on the Contact** (Settings → Custom Fields → Contact)
   Mirror every column we surface in the admin Leads table. Use the exact field keys below so the edge function maps cleanly:
   - `vehicle_reg` (text), `vehicle_make`, `vehicle_model`, `vehicle_year`, `mileage`
   - `plan_id`, `plan_name`, `payment_type`, `total_price`, `voluntary_excess`
   - `claim_limit`, `warranty_duration`
   - `step_abandoned`, `lead_source`, `original_source`, `priority`
   - `fbclid`, `gclid`, `utm_source`, `utm_medium`, `utm_campaign`
   - `assigned_agent`, `last_activity_date`, `notes_summary`

4. **Create Tags** the function will apply automatically:
   `buyawarranty`, `step-1`, `step-2`, `paid`, `repeat-customer`, `suspicious`, plus a source tag (`source-google`, `source-facebook`, `source-organic`).

5. **Build the "Leads" Smart List view** (Contacts → Smart Lists → New)
   - Filter: Tag contains `buyawarranty`
   - Columns: Name, Phone, Email, `vehicle_reg`, `plan_name`, `total_price`, `step_abandoned`, Pipeline Stage, Assigned User, Last Activity
   - Sort: Last Activity desc
   This becomes the GHL equivalent of our admin Leads tab.

## Part 2 — Wire every lead capture point to push-to-ghl

Add a fire-and-forget call to `push-to-ghl` from each lead entry point. Existing function signature already accepts the right shape; we just need to extend it slightly and call it from more places.

**Edge functions to update:**

| Function | When it fires | Action |
|---|---|---|
| `track-abandoned-cart` | Already wired ✅ | No change |
| `capture-step1-lead` (or wherever Step 1 reg + contact is saved to `sales_leads`) | On insert | Add `fetch(.../push-to-ghl)` with `step_abandoned: 1` + tag `step-1` |
| `handle-successful-payment` | After Stripe success | Push with `step_abandoned: "paid"` + tag `paid`, include `total_price`, `plan_id`, `payment_type` |
| `process-payment-assist-success` | After Bumper success | Same as above |
| `capture-facebook-lead` | FB Lead Ads | Push with tag `source-facebook` |

**Enhance `push-to-ghl/index.ts`:**
1. Map our internal `status` → GHL pipeline stage ID (env vars `GHL_PIPELINE_ID`, `GHL_STAGE_NEW_ID`, etc.) and create/update an Opportunity in the Website Leads pipeline alongside the contact upsert.
2. Compute tags dynamically from payload (`paid`, `step-1/2`, `source-*`, `suspicious` if flagged).
3. Add `assignedTo` if `assigned_agent` is provided (requires a GHL user ID lookup map kept in env or a small `ghl_user_map` table).
4. Always set `last_activity_date` custom field.

## Part 3 — Keep GHL in sync with admin actions (optional but recommended)

Add a Postgres trigger on `sales_leads` (AFTER UPDATE) that enqueues a row into `ghl_push_queue` whenever `status`, `assigned_agent`, or `notes` changes. The existing `retry-ghl-pushes` cron will drain it. This way: when an admin changes status in our dashboard, the GHL contact's pipeline stage / assigned user updates automatically.

## Part 4 — Secrets & deployment

1. Add `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_PIPELINE_ID`, and one `GHL_STAGE_<NAME>_ID` per stage as Supabase secrets.
2. Deploy the updated edge functions.
3. Smoke test: submit a reg on the live site → confirm contact appears in GHL Smart List within ~10s, with custom fields populated and Opportunity in "New" stage.
4. Verify retry queue: temporarily set a bad token, submit a lead, confirm row lands in `ghl_push_queue` and is retried.

## Part 5 — Reverse sync (optional, future)
If you also want GHL → admin sync (e.g. agent updates stage in GHL), set up a GHL Workflow → Webhook on "Opportunity Stage Changed" pointing at a new `ghl-webhook` edge function that updates `sales_leads.status`.

## What I need from you to start building
1. Confirm Part 1 is done in GHL and share back:
   - `GHL_API_KEY` (pit-…)
   - `GHL_LOCATION_ID`
   - `GHL_PIPELINE_ID` and each stage ID
2. Confirm the lead entry points list above is complete (any other forms / quote flows I should hook into?).
3. Confirm whether you want Part 3 (admin → GHL sync) and Part 5 (GHL → admin sync) included now or later.
