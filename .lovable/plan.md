

## Goal
Build a dealer multi-step quote → pricing → checkout journey under `/dealer-portal/quote/*` that mirrors the retail UX but is fully isolated, applies a flat dealer discount, supports Pay Now (Stripe) **or** Add to Invoice, and produces a single warranty record visible in **both** the admin Customers dashboard (flagged as dealer) and the dealer's own dashboard.

## Architecture decisions (from your answers)

1. **Pricing** = retail engine output × `(1 - dealer_discount_pct)`. New column `dealers.discount_pct` (default 0). One knob per dealer.
2. **Checkout** = dealer chooses **Pay Now** (Stripe) or **Add to Monthly Invoice** (creates record immediately, marked `payment_status='invoice_pending'`).
3. **Warranty record** = single source of truth in the existing `customers` table (so it lands in the admin dashboard exactly like a retail order). Tagged via:
   - `purchase_source = 'dealer'`
   - new column `customers.dealer_id` (FK → `dealers.id`, nullable)
   The dealer dashboard then queries `customers WHERE dealer_id = me`. No data duplication. Admin sees a "Dealer" badge + dealer name on those rows.

## Database changes (one migration)

```sql
ALTER TABLE dealers ADD COLUMN discount_pct numeric(5,2) DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 50);
ALTER TABLE customers ADD COLUMN dealer_id uuid REFERENCES dealers(id);
CREATE INDEX idx_customers_dealer_id ON customers(dealer_id) WHERE dealer_id IS NOT NULL;

-- RLS: dealers can SELECT customers WHERE dealer_id = their dealer.id
CREATE POLICY "Dealers view own customer orders" ON customers
  FOR SELECT TO authenticated
  USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
```

## New routes (isolated, dark theme)

```
/dealer-portal/quote/vehicle      → Step 1: Vehicle reg + mileage (auto-prefilled from hero)
/dealer-portal/quote/customer     → Step 2: End-customer details (dealer fills in)
/dealer-portal/quote/pricing      → Step 3: Plan + duration + add-ons (retail UI, dealer prices)
/dealer-portal/quote/checkout     → Step 4: Pay Now (Stripe) OR Add to Invoice
/dealer-portal/quote/confirmation → Step 5: Warranty issued, links to dashboard
```

Auth-guarded — non-dealers redirected to `/dealer-portal/login`.

## Files to build

### New
- `src/contexts/DealerJourneyContext.tsx` — state holder for the 4-step flow (vehicle, customer, plan, pricing). Persists to `sessionStorage` key `dealerJourney` (separate from retail's `buyawarranty_*` keys).
- `src/components/dealer/journey/DealerJourneyLayout.tsx` — dark wrapper + progress indicator (4 dots, orange) + auth guard.
- `src/pages/dealer-portal/journey/Step1Vehicle.tsx` — reuses vehicle lookup edge function; dark-themed card.
- `src/pages/dealer-portal/journey/Step2Customer.tsx` — name, email, phone, address (dealer types end-customer details).
- `src/pages/dealer-portal/journey/Step3Pricing.tsx` — wraps existing `PricingTable` logic but applies dealer discount via a `priceMultiplier` prop (see below) and renders in dark theme.
- `src/pages/dealer-portal/journey/Step4Checkout.tsx` — summary + two CTAs: "Pay now (card)" and "Add to monthly invoice".
- `src/pages/dealer-portal/journey/Step5Confirmation.tsx` — success screen, link to warranty in dashboard.
- `supabase/functions/dealer-create-checkout/index.ts` — handles both Pay Now (creates Stripe session, dealer's email as payer) and Invoice (no Stripe, just inserts customer row immediately).
- `supabase/functions/dealer-stripe-webhook/index.ts` — listens to dealer Stripe sessions and inserts the customer row on success (mirrors retail webhook).

### Modified
- `src/components/PricingTable.tsx` — add optional `priceMultiplier?: number` prop (defaults to 1). Multiply final displayed prices by it. Add optional `theme?: 'light' | 'dark'` to swap a few bg classes. Zero impact on retail (uses default).
- `src/components/dealer/DealerRegHero.tsx` — change logged-in nav target from `/dealer-portal/quotes/create` to `/dealer-portal/quote/vehicle?reg=…`.
- `src/pages/dealer-portal/DealerDashboard.tsx` — add a third stats card "Orders" pulling `customers WHERE dealer_id = me`; add "Recent Dealer Orders" section.
- `src/pages/dealer-portal/DealerWarrantiesList.tsx` — switch source from `dealer_warranties` table to `customers WHERE dealer_id = me` (single source of truth) so it matches admin.
- `src/App.tsx` — register the 5 new routes; extend `isDealerDashboard` footer-hide to include `/dealer-portal/quote`.
- Admin Customers tab (locate file via search) — add a "Dealer" badge + dealer company name when `customers.dealer_id` is set, plus a `dealer_id` filter.

### Kept as-is (legacy, still works)
- `DealerCreateQuote.tsx` (single-form quick quote) — left in place so existing `/dealer-portal/quotes/create` keeps working. Linked from sidebar as "Quick quote" alongside the new "Start full quote" button.

## Pricing isolation
- Dealer journey reads `dealer.discount_pct` once at journey start, stores in context.
- All price displays in Step 3/4 = `retailPrice * (1 - discount_pct/100)`.
- Stripe `unit_amount` and saved `customers.amount` use the **discounted** price.
- `customers.purchase_source = 'dealer'` and `customers.dealer_id = X` so admin reports/analytics can segment.

## Edge cases handled
- Session expiry mid-journey → save context to sessionStorage → on rehydrate, redirect to login with `?redirect=/dealer-portal/quote/<step>`.
- Logout mid-journey → clear `dealerJourney` sessionStorage.
- Stripe payment fails → return to Step 4 with error toast, journey state preserved.
- Invoice option → record created instantly with `payment_status='invoice_pending'`, dashboard shows amber "Awaiting invoice" badge.

## Visibility flow (the key requirement)
```text
Dealer completes /dealer-portal/quote/checkout
        │
        ├─ Pay Now ── Stripe session ── webhook ─┐
        │                                         ▼
        └─ Invoice ──────── direct insert ──► customers table
                                                  │ (dealer_id=X, purchase_source='dealer')
                            ┌─────────────────────┼─────────────────────┐
                            ▼                                           ▼
                  Admin Customers tab                          Dealer Dashboard
                  (sees "Dealer: AcmeMotors" badge)            (sees own orders only via RLS)
```

## Out of scope (flag)
- Monthly invoice generation/email automation (the "Add to Invoice" button just marks the record; actual invoicing PDF/email is a follow-up).
- Per-dealer custom add-on pricing (current scope = single flat discount %).
- Editing dealer discount % from the dealer side (admin-only for now; you'll need to update via SQL or admin UI — flag if you want a UI).

## Files touched (summary)
**Create (10):** DealerJourneyContext, DealerJourneyLayout, Step1-5 pages, dealer-create-checkout edge fn, dealer-stripe-webhook edge fn, 1 migration
**Modify (5):** PricingTable.tsx, DealerRegHero.tsx, DealerDashboard.tsx, DealerWarrantiesList.tsx, App.tsx, + admin Customers tab badge

