---
name: Price Updates — £399 floor is Quotes & Orders only, not website
description: Test/proposed pricing model: £399/£658/£938 floors (cheapest combo) apply to the sales Quotes & Orders grid only; website prices have no floor; no £500 excess on 1 year
type: feature
---
Applies to the management **Price Updates** page (`PriceUpdatesTab.tsx`,
`pricing/PriceTestStep2.tsx`) — live Step 3/4 code pricing is untouched.

- **Quotes & Orders floor:** never below **£399** (12mo), **£658** (24mo, ×1.65),
  **£938** (36mo, ×2.35) at the cheapest option combo — richer options step it up. Agents discount down from this grid, so the floor guards
  the admin cell value. Cells under the floor are flagged as below the Quotes & Orders floor.
- **Website prices are NOT floored.** There is no acquisition cost on the website, so a
  derived website price below the floor (e.g. £250) is valid and displayed as-is — never raised.
- **No £500 excess on one-year cover.** £500 excess also stays limited to £3,000/£5,000
  claim limits (25%-of-limit guardrail).
- Motorbikes: 50% of standard vehicle pricing, and these floors halve with it.
- Matrix columns are internal: 750 = AutoCare Basic (£1,000 displayed), 2000 = Essential (£2,000),
  1250 = legacy/promo fallback. Elite £3,000 and Premium £5,000 are derived columns.
