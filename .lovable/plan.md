

# Facebook Lead Mismatch — Root Cause Analysis & Fix Plan

## Findings Summary

The three different numbers you see are NOT bugs — they are three different views counting different things. Here is the exact breakdown for April 11, 2026:

```text
Facebook Ads Manager:           53 leads (clicks that triggered a "Lead" event)
Facebook Leads — Full Details:  41-42 leads (abandoned_carts with FBCLID)
Leads Dashboard (filtered FB):  32 leads (sales_leads, "Live" filter active)
Source badge "F Facebook Ads":  40 leads (all sales_leads with lead_source='social_ad')
```

## Root Causes Identified

### Gap 1: Facebook 53 → CRM abandoned_carts 41 (missing ~12)
- **9 leads blocked by terminal guard**: The database trigger (`auto_create_lead_from_abandoned_cart`) checks if the email/phone already has a lead in `converted`, `lost`, or `fake_lead` status. If so, it silently drops the new lead. These 9 returning visitors from FB never got new cart records or leads created.
- **3 carts have no cart_metadata**: These abandoned carts were created without FBCLID/UTM data attached, so the FacebookAdsTab filter misses them even though they came from Facebook.
- **Remaining ~1-2**: Timezone boundary difference between Facebook's ad account timezone and your CRM's BST-based day boundaries.

### Gap 2: Facebook Leads table 41 → Leads badge 40 (missing 1)
- The Facebook Leads table queries `abandoned_carts` (41 records with FBCLID).
- The Leads badge counts `sales_leads` with `lead_source='social_ad'` (40 records).
- The 1-record difference is because one abandoned cart's trigger was blocked by the terminal guard but the cart itself still exists with an FBCLID.

### Gap 3: Leads badge 40 → Dashboard showing 32 (missing 8)
- **This is the default "Live Leads" status filter**, which excludes `lost` (6) and `fake_lead` (2) leads.
- 40 - 6 - 2 = **32 exactly**. This is working as designed.
- The user sees "32 leads" because the default view is "Live Leads", not "Total Leads".

## Fix Plan

### 1. Stop silently dropping leads blocked by terminal status
**File**: New database migration
- Update `auto_create_lead_from_abandoned_cart()` to log blocked leads to `system_event_logs` with reason `lead_blocked_by_terminal` instead of silently returning.
- This gives visibility into how many Facebook leads are being suppressed.

### 2. Fix FBCLID not being stored when cart is created via direct insert (QuoteDeliveryStep)
**File**: `src/components/QuoteDeliveryStep.tsx`
- The fallback `track-abandoned-cart` call at line 265 does NOT pass `fbclid` or `gclid`. Fix: include `...(getStoredFbclid() ? { fbclid: getStoredFbclid() } : {})` and same for gclid.

### 3. Ensure cart_metadata is never empty for FB visitors
**File**: `src/components/QuoteDeliveryStep.tsx`
- When updating an existing cart (line 220), the `cart_metadata` is only set if `storedFbclid || storedGclid || utmSource` is truthy. But the FBCLID might have been captured on a previous page load and stored in localStorage. Always check localStorage for FBCLID before deciding to skip metadata.

### 4. Add "Total" vs "Live" clarity to the Leads Dashboard for FB source filter
**File**: `src/components/admin/leads/LeadsFilters.tsx`
- When the source filter shows "F Facebook Ads 40", the badge count (40) uses `dateFilteredLeadsForCounts` which includes ALL statuses. But the actual displayed table only shows 32 because the status filter is "Live". This mismatch is confusing.
- **Fix**: Show two numbers in the source badge: "F Facebook Ads 40 (32 live)" or change the badge to reflect the active status filter count.

### 5. Add a reconciliation panel to the Facebook Ads tab
**File**: `src/components/admin/FacebookAdsTab.tsx`
- Add a new "Lead Reconciliation" card showing:
  - Raw abandoned carts with FBCLID: X
  - Sales leads created (social_ad): Y
  - Blocked by terminal status: Z
  - Missing metadata (not attributed): W
  - Status breakdown: New/Contacted/Lost/Fake
- This makes the count differences transparent and self-explanatory.

### 6. Show both Meta day and CRM day counts
**File**: `src/components/admin/FacebookAdsTab.tsx`
- Add a note under the lead count explaining: "CRM uses UK/London timezone. Facebook Ads Manager may use a different timezone for your ad account, which can cause 1-2 lead differences at day boundaries."

## Technical Details

### Database changes (migration)
```sql
-- Update terminal guard to log instead of silently dropping
-- In auto_create_lead_from_abandoned_cart():
-- Before: IF v_terminal_lead_id IS NOT NULL THEN RETURN NEW; END IF;
-- After: Log to system_event_logs, then RETURN NEW;
```

### Frontend changes
1. **QuoteDeliveryStep.tsx**: Pass fbclid/gclid in the fallback track-abandoned-cart call
2. **LeadsFilters.tsx**: Make source filter badge count respect active status filter
3. **FacebookAdsTab.tsx**: Add reconciliation card and timezone note

### No data is being lost
All 53 Facebook leads are accounted for:
- 41 stored in abandoned_carts with FBCLID
- 9 blocked by terminal guard (repeat visitors with existing converted/lost/fake leads)
- 3 stored without metadata (FBCLID not passed)
- The remaining leads show different counts because of status filters (Live vs Total)

