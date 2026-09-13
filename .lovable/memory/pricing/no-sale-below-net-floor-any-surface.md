---
name: No sale below the net floor on ANY surface (13 Sep 2026)
description: Promo codes may no longer take a website/Stripe sale below £399/£769/£1,099 (12/24/36mo, halved for motorbikes) — the old "promos can breach the floor" rule is revoked
type: constraint
---
Trigger: a £480 quote sold for £360 via Stripe with a 25% promo code (SAVE25).

Rule (user instruction, 13 Sep 2026): block ALL sales confirmations below the
term net floor — £399 (1yr) / £769 (2yr) / £1,099 (3yr), halved for motorbikes.
The user said "399, 699, 999" but the agreed Sep 2026 floors £769/£1,099 are
stricter and were kept.

The old exemption "website promo codes (SAVE25, cart recovery, pay-in-full 10%)
may breach the net floor" is **revoked**. Never reintroduce it.

Enforcement points (all must stay in sync):
- Server: `supabase/functions/_shared/price-floor.ts` — `getTermFloorGBP` now
  returns the FULL term floor (halved only when `isMotorbike: true` is passed);
  the 60%-of-half backstop was removed. All 7 checkout functions pass
  `isMotorbike` from `vehicleData.vehicleType`. Only live TEST*/SAVE99GOLDEN
  codes keep the £1 floor.
- Client: `minimumPriceForCodes(codes, termFloorGBP?)` in
  `src/lib/testPromoBypass.ts` and `promoPriceFloor`/`calcPromoDiscount` in
  `src/lib/promoStorage.ts` accept the term floor; call sites in
  `StreamlinedCheckout.tsx`, `PricingTable.tsx`, `Step3Desktop.tsx` and
  `MobileSteppedFlow.tsx` pass `getNetPayableFloor({...surface: 'admin'})`.

Management override below the floor still exists ONLY on the admin
Confirm External Payment path (logged to `price_override_audit`).

**Hard £299 absolute minimum (13 Sep 2026):** no non-motorbike sale may
complete below £299 under ANY circumstances — management overrides, approved
authorisations and price matches included. Only website motorbikes are exempt
(half-price floor £199.50). Enforced by `HARD_ABSOLUTE_MIN_TOTAL` /
`isUnderHardAbsoluteMin` in `src/lib/pricing/netFloor.ts`, gated at the top of
`handleConfirmPayment` in `ConfirmExternalPaymentTab.tsx` and the confirm
handler in `GetQuoteTab.tsx`, and as a backstop in
`supabase/functions/_shared/price-floor.ts`. Live manager TEST codes keep the
£1 QA floor.
