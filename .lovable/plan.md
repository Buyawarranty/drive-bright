

# Fix Lead Count Mismatch: Google/Facebook vs CRM Dashboard

## Problem Identified

The CRM is **silently blocking paid leads** when a returning visitor clicks a Google or Facebook ad but already has a lead in terminal status (`converted`, `lost`, or `fake_lead`). This is the primary cause of the count mismatch.

**Evidence from database (April 13, 2026):**
- **5 Google Ads leads blocked** by terminal guard
- **1 Facebook lead blocked** by terminal guard
- Google Ads Manager showed ~30 leads but CRM only counted ~26 (the 5 blocked ones explain the gap)

The terminal guard currently logs the block to `system_event_logs` but does NOT create a new lead — meaning these visitors are never visible in the leads dashboard.

## Root Cause

In the `auto_create_lead_from_abandoned_cart()` trigger (step 4 — Terminal Guard):
- If a visitor's email or phone matches an existing lead in `converted`/`lost`/`fake_lead` status, the trigger logs it and returns without creating a new lead
- This made sense for organic repeat visitors, but for **paid traffic** (Google/Facebook ads), you're paying for these clicks and they should always generate a new lead

## Fix Plan

### 1. Update the database trigger to create new leads for paid sources blocked by terminal guard

**Change**: When the terminal guard would block a lead, check if `v_derived_source` is `google_ad` or `social_ad`. If it's a paid source, skip the terminal block and proceed to create a new lead via round-robin assignment. Only block organic (`website`) repeat leads.

This ensures every Google/Facebook ad click that generates a form submission creates a visible lead in the CRM, matching what the ad platforms report.

### 2. Backfill previously blocked paid leads

**Change**: Query `system_event_logs` for all `lead_blocked_by_terminal` entries where `lead_source` is `google_ad` or `social_ad`, and create new `sales_leads` records from the corresponding `abandoned_carts` data. This recovers the historically lost leads.

### 3. Fix the jones2969 misattribution case

**Change**: Run a one-time backfill to re-derive `lead_source` for any `sales_leads` records whose linked `abandoned_cart` has an FBCLID/GCLID but the lead is still marked as `website`. This is the same fix pattern from migration `20260327063932` but needs to run again for recent data.

## What Does NOT Change
- Dashboard counting logic (it's correct — it counts what's in the DB)
- Frontend fbclid/gclid capture (already working correctly)
- Deduplication logic for active leads (phone/email dedup remains unchanged)
- Lead assignment, round-robin, or any other workflow
- No frontend code changes needed

## Technical Details

**Migration SQL** will:
1. `CREATE OR REPLACE FUNCTION auto_create_lead_from_abandoned_cart()` — modify the terminal guard section to only block `website` source leads, allowing `google_ad` and `social_ad` leads to pass through and get created
2. Backfill query to create leads from blocked paid entries in `system_event_logs`
3. Re-derive misattributed lead sources from cart metadata

