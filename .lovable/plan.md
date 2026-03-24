

## Plan: Stop Auto-Creating Warranty on Payment — Let Sales Complete Orders Manually

### Problem
When a customer pays via a quote link (Stripe or Bumper), the system automatically:
1. Creates a customer record (often a duplicate)
2. Creates a warranty/policy
3. Sends a welcome email with incorrect details

The sales agent should instead review the paid order, correct any details, and manually trigger the customer record + email.

### Current Flow
```text
Customer pays → stripe-webhook / process-quote-bumper-success
  → handle-successful-payment (creates customer + policy + sends email)
  → Paid order appears in "Paid Orders" tab (but damage already done)
```

### New Flow
```text
Customer pays → stripe-webhook / process-quote-bumper-success
  → Only update live_quotes status to "paid" (NO customer/policy creation)
  → Redirect to thank-you page with quote details
  → Order appears in "Paid Orders" tab with "⚠️ Needs Processing" badge
  → Sales agent opens order → reviews/edits details → clicks "Complete Order"
  → System creates customer (or links to existing) + policy + sends welcome email
```

### Changes Required

**1. Stripe Webhook (`supabase/functions/stripe-webhook/index.ts`)**
- For live_quote-sourced payments (`metadata.source === 'live_quote'`): instead of calling `handle-successful-payment`, just update the `live_quotes` record to `status: 'paid'` with the payment details (Stripe session ID, amount). Skip warranty creation and email entirely.
- Non-quote payments (direct website checkout) remain unchanged.

**2. Bumper Success Handler (`supabase/functions/process-quote-bumper-success/index.ts`)**
- Remove the call to `handle-successful-payment` and the welcome email send.
- Only update `live_quotes` to `status: 'paid'` with `payment_method: 'bumper'`.
- Still redirect to the thank-you page with quote details (from `live_quotes` data, not from a newly created policy).

**3. Paid Orders Tab — Add "Complete Order" Action (`src/components/admin/PaidOrderEditDialog.tsx`)**
- Add a new "Complete Order & Send Email" button that:
  - Calls `confirm-external-payment` (which already handles customer creation, duplicate detection, policy creation, and welcome email)
  - Passes all the edited details from the dialog form
  - On success, updates the `live_quotes` record with the policy number
  - Shows success confirmation
- Add visual distinction: orders without a `customer_id` or `policy_id` show a prominent "Needs Processing" status badge instead of "Paid"

**4. Paid Orders Tab — Status Indicators (`src/components/admin/PaidOrdersTab.tsx`)**
- Update `getStatusBadge` to show amber "Needs Processing" for paid orders that have no `customer_id` or `policy_id`
- Sort unprocessed orders to the top

### Technical Details

- The `confirm-external-payment` edge function already has full duplicate detection logic (matches by email + reg plate), creates or updates customers, creates policies, and optionally sends welcome emails. This is the ideal function for the sales agent to trigger manually.
- The thank-you page continues to work because it reads from URL params (populated from `live_quotes` data), not from the customer/policy tables.
- No database migration needed — `live_quotes` already has the `status`, `paid_at`, `payment_method`, and `policy_number` columns.

### Files to Edit
1. `supabase/functions/stripe-webhook/index.ts` — Skip `handle-successful-payment` for live_quote payments
2. `supabase/functions/process-quote-bumper-success/index.ts` — Remove warranty creation, keep redirect
3. `src/components/admin/PaidOrderEditDialog.tsx` — Add "Complete Order & Send Email" button
4. `src/components/admin/PaidOrdersTab.tsx` — Add "Needs Processing" status, sort unprocessed first

