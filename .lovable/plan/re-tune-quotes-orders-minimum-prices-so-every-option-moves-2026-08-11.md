# Re-tune Quotes & Orders minimum prices so every option moves

## What's wrong today

Two separate clamps are flattening cheap quotes:

1. **The hard bottom is anchored on the "reference" combo** (£2,000 claim, £70/hr labour, £150 excess) at £399, and the shaping is wrapped in `Math.max(1, shape)`. Any option *cheaper* than the reference (claim £1,000, excess £250/£500, labour £50) gets shape < 1, which is clamped back to 1. Result: £1,000 and £2,000 claim limits land on exactly the same price, and £0 → £500 excess barely moves once a vehicle is floor-bound.
2. Most cheaper/older vehicles sit **at** that hard bottom, so the flattening is what agents actually see on nearly every quote.

## What I'd change

Re-anchor the hard bottom on the **cheapest possible combo** and let the ladder climb from there — nothing clamped.

- Cheapest sellable Quotes & Orders total (12 months, £1,000 claim, £50/hr labour, £500 excess): **£349**
- 24 months: **£576** (×1.65) · 36 months: **£821** (×2.35)
- Motorbikes: half of the above (£175 / £288 / £411)
- Website Step 3 stays the Quotes & Orders figure minus the live web gap (10%)

### Ladder multipliers (relative to the cheapest = 1.00)

| Claim limit | × | Labour | × | Excess | × |
|---|---|---|---|---|---|
| £1,000 | 1.00 | £50 | 1.00 | £500 | 1.00 |
| £2,000 | 1.06 | £70 | 1.03 | £250 | 1.02 |
| £3,000 | 1.14 | £100 | 1.08 | £150 | 1.045 |
| £5,000 | 1.26 | £150 | 1.20 | £100 | 1.07 |
| | | | | £50 | 1.10 |
| | | | | £0 | 1.14 |

These are deliberately compressed so the popular combo doesn't get more expensive than it is today.

### What that produces at 12 months (floor-bound vehicle)

| Combo | New floor | Today |
|---|---|---|
| £1,000 · £50/hr · £500 excess | £349 | £399 |
| £1,000 · £50/hr · £150 excess | £365 | £399 |
| £2,000 · £70/hr · £150 excess (reference) | £398 | £399 |
| £3,000 · £70/hr · £100 excess | £438 | £399 |
| £5,000 · £150/hr · £0 excess | £602 | £519 |

So: cheapest quote is £349, £1,000 vs £2,000 claim now differ, and every excess tier moves.

## Technical detail

- `src/lib/pricingMatrix.ts` — set `ABSOLUTE_MIN_GRID_BY_PERIOD` to 349 / 576 / 821, move `ABS_MIN_ANCHOR` to the cheapest combo, replace `getClaimLimitFloorFactor` weights with the compressed ladder above, add matching labour/excess ladders, and drop `Math.max(1, shape)`.
- `src/components/admin/pricing/modelQuoteEngine.ts` — same change to `ABSOLUTE_MIN_GRID_BY_MONTHS` and remove the `Math.max(1, absShape)` clamp so the age-band model matches.
- `src/lib/pricing/netFloor.ts` — net payable floor follows the same figures, so a 30% agent discount still can't go below £349.
- Shaped floor (`applyBasePriceFloor`) and `MIN_SELLABLE_BY_MONTHS` (249/498/747) unchanged.
- Applies to every model on Price updates (July, Aug hybrid, code-base, historical) because they all read these constants.

Nothing in the customer journey pricing formula itself changes — only the minimums and their shaping.
