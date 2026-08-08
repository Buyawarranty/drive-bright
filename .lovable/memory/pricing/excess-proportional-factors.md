---
name: Voluntary excess is proportional, never a flat £/mo table
description: Excess prices as a % factor of the cover price anchored on £100 Balanced (1.08/1.04/1.00/0.97/0.87/0.80), on Step 3/4, Quotes & Orders and the price sandboxes
type: feature
---
Voluntary excess is priced as a FACTOR of the cover price, anchored on £100
"Balanced" = 1.00 (`EXCESS_PRICE_FACTOR` in `src/lib/pricingMatrix.ts`):

- £0 = 1.08, £50 = 1.04, £100 = 1.00, £150 = 0.97, £250 = 0.87, £500 = 0.80

That keeps the agreed shape: £250 ≈ 10% below £150, £500 ≈ 18% below £150.

Rules:
- Always pass the excess-neutral base total into `getExcessTotalAdjustment` /
  `getExcessMonthlyDelta`. The flat £/mo table is a fallback for hints only —
  it made £0 and £500 land within a few pounds of each other on a real quote.
- The minimum-price floor is shaped by the SAME factor
  (`EXCESS_FLOOR_MULTIPLIER`, and `getExcessFactor` in `modelQuoteEngine`), or
  floor-bound vehicles collapse every excess onto one price.
- `getExcessBracketBasis` undoes excess by DIVIDING by the tier factor.
- Every surface must move: Step 3 desktop/mobile, Step 4, Quotes & Orders,
  Aug hybrid sandbox, age-band grid preview.
