---
name: Customer journey +10% uplift (Aug 2026)
description: Step 3 → Step 4 customer prices are base grid +10% (whole £); admin Quotes & Orders unchanged
type: feature
---
Aug 2026: `CUSTOMER_JOURNEY_PRICE_MULTIPLIER = 1.10` in `src/lib/pricingMatrix.ts`.

Applied via `applyCustomerJourneyUplift(price, surface)` in two places only:
- `getBasePrice` (both the live-override path and the code matrix path) when `surface === 'customer'`
- `applyBasePriceFloor` (floor uplifted then halved for motorbikes) when `surface === 'customer'`

So the uplift hits base matrix price + minimum price floor, rounded to whole pounds.
Labour rate, boost, add-ons and fixed vehicle adjustments keep their exact incremental amounts.

Admin Quotes & Orders is NOT uplifted: `calculateAdminQuoteWarrantyPrice` now calls
`calculateTotalWarrantyPrice({ ...params, surface: 'admin' })` before applying
`ADMIN_QUOTE_PRICE_MULTIPLIER`, and `BulkPricingTab` passes `'admin'` to `getBasePrice`.
Net effect: admin grid identical to before; customer journey ≈ admin grid (was admin −10%).

Step 3 and Step 4 stay identical because Step 4 consumes the pre-floored `monthlyPrice`
from `PricingTable.tsx` and both read the same central helpers.
Dealer portal `calcDealerPrice` is unaffected.
