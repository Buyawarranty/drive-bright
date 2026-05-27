## What needs to change

Three connected fixes around the Step 3 → Step 4 flow.

### 1. One promo code, persisted across visits

**Today:** `appliedDiscountCodes` lives only in `StreamlinedCheckout` React state. If the customer leaves and comes back (new tab, refresh, return from gateway), state resets so they can re-enter another code. The auto-applied promo banner is also unaware of any manually entered code.

**Fix:**
- Persist `appliedDiscountCodes` in `localStorage` keyed by normalised email + reg plate (`promoApplied:{email}:{reg}`). Hydrate on mount; clear on successful payment.
- Keep the existing client guard (`appliedDiscountCodes.length > 0` → reject) and reuse it for both manual entry and the auto-apply banner so the two paths can never stack.
- Harden the `validate-discount-code` edge function: when an `customer_email` + `vehicle_reg` combo already has a different active code recorded against it, reject the new one with `"Only one promo code can be used per purchase"`. (Uses the existing `discount_code_usage` table — no schema changes.)

### 2. Promo visible on Step 3 (price parity with Step 4)

**Today:** Promo input only exists on Step 4. Step 3 sticky / cards show the un-discounted monthly, so the price visibly drops on Step 4, which looks like a bug.

**Fix:**
- Read the persisted promo (`localStorage`) inside `PricingTable.tsx`.
- If a valid promo exists, derive a `discountedMonthlyPrice = floor((totalPrice * (1 - pct)) / 12)` (or fixed-amount equivalent) and use it everywhere Step 3 currently shows `displayMonthlyPrice` / `monthlyPrice`: duration cards, mobile sticky, desktop sticky, "Pay in full", email-quote dialog.
- Show a small inline badge under the sticky price: `Promo CODE applied — Save £X`, with a "Remove" link that clears the persisted promo.
- Pass the discounted figures through `onPlanSelected` so Step 4 inherits them (per the existing pricing-sync constraint in `.note/pricing-sync-constraint.md`).

### 3. Move "Email quote" out of the sticky bar

**Today:** `MobileStickyFooter` renders an "Email quote" link in both collapsed and expanded states, taking vertical space.

**Fix:**
- Remove the `EmailQuoteLink` block from `MobileStickyFooter` (keep the `onEmailQuote` prop optional for backward compat but unused there). Tighten the sticky card's vertical padding now that the link is gone (`pb-3` → `pb-2.5`, drop the `mt-2` spacer).
- In `MobileSteppedFlow.tsx`, render a new "Email me this quote" link directly **after** the `TrustAndInfoAccordion` (which contains "Frequently asked questions"), wired to the existing `setEmailQuoteOpen(true)`.
- Do the same on desktop (`Step3Desktop.tsx`): drop the email-quote link from any sticky-bar area and add it as a centered link under the FAQ section.

## Files touched

- `src/components/checkout/StreamlinedCheckout.tsx` — persistence load/save, clear on success
- `supabase/functions/validate-discount-code/index.ts` — cross-code rejection per email+reg
- `src/components/PricingTable.tsx` — hydrate promo, apply discount to displayed prices, sticky promo badge, pass discounted figures to Step 4
- `src/components/checkout/MobileStickyFooter.tsx` — remove email quote link, tighten padding
- `src/components/step3/MobileSteppedFlow.tsx` — render email quote link below FAQ accordion
- `src/components/step3/Step3Desktop.tsx` — same email-quote relocation for desktop
- New helper: `src/lib/promoStorage.ts` — typed get/set/clear for the persisted promo

## Out of scope

- No schema changes; reuses `discount_code_usage`.
- No changes to Stripe/Bumper checkout-creation logic beyond receiving the already-discounted amount it already accepts.
- No copy/UX changes to the promo entry form itself.
