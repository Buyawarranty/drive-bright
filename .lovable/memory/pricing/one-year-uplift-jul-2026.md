---
name: 12-month +5% uplift (Jul 2026)
description: 12-month base matrix and floors raised 5%; 24/36mo untouched; dealer portal excluded
type: feature
---
Jul 2026: `BASE_PRICING_MATRIX['12months']` raised +5% (floored) in `src/lib/pricingMatrix.ts`.
Floor `MIN_BASE_PRICE_BY_PERIOD['12months']` 280 → 294; `EXCESS_TIER_STEP_BY_PERIOD['12months']` 20 → 21.

24months/36months untouched (they keep the Jul 2026 +20% uplift).
Applies to BOTH the customer journey (Step 3 → Step 4) and admin Quotes & Orders
(admin layers its +10% markup on top via `calculateAdminQuoteWarrantyPrice`).
Dealer portal `calcDealerPrice` is a separate engine and is NOT affected.

Claim-limit tiers read only the 750 (displayed £1,000) and 2000 (£2,000) columns;
1250 stays as the legacy default/promo fallback and was uplifted in step.
Elite (£3,000) is derived as (2000 col − 750 col), so it rises automatically;
the £5,000 premium step (£8/£9/£10 per month) is unchanged.
