---
name: Quotes & Orders minimum price ladder (£349 cheapest, Aug 2026)
description: Hard bottom is £349/£699/£999 at the CHEAPEST combo (£1,000 claim, £50 labour, £500 excess) and steps up a compressed ladder — never clamped
type: feature
---
The absolute/net minimum for Quotes & Orders is anchored on the **cheapest
reachable combo** (£1,000 claim limit, £50/hr labour, £500 excess):

- 12 months **£349** · 24 months **£699** · 36 months **£999** · motorbikes half
- Website Step 3 = these figures minus the live web gap (10%)

Every richer option steps the hard bottom UP a compressed ladder
(`getAbsoluteMinimumShape` in `src/lib/pricingMatrix.ts`), so £1,000 vs £2,000
claim limits and all six excess tiers stay on visibly different prices even when
a vehicle is floor-bound:

- claim: 1000 = 1.00, 2000 = 1.06, 3000 = 1.14, 5000 = 1.26
- labour: £50 = 1.00, £70 = 1.03, £100 = 1.08, £150 = 1.20
- excess: £500 = 1.00, £250 = 1.02, £150 = 1.045, £100 = 1.07, £50 = 1.10, £0 = 1.14

Reference combo (£2,000 / £70 / £150) lands at ~£399, so the popular quote did
not get more expensive.

**Never re-introduce `Math.max(1, shape)`.** Anchoring on the reference combo and
clamping the shape to >= 1 is exactly what made cheaper options collapse onto one
price. Every surface (live grid, `modelQuoteEngine`, `PriceTestStep2`,
`netFloor`, `pricingVersionConfig`, `AgeBandPricingPreview`, `PriceUpdatesTab`)
must read these same constants.
