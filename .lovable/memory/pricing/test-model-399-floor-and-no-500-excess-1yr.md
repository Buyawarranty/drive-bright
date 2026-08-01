---
name: Price Updates test model — £399 floor, no £500 excess on 1 year
description: Test/proposed pricing model rules: minimum sellable £399 (1yr), £659 (2yr), £938 (3yr); £500 excess never offered on one-year cover
type: feature
---
Applies to the management **Price Updates** test page only (`PriceUpdatesTab.tsx`,
`pricing/PriceTestStep2.tsx`) — live Step 3/4 and Quotes & Orders are untouched.

- Rule of thumb: never sell a warranty under **£399** for one year.
  Term floors follow the proposed multipliers: 12mo £399, 24mo £659 (×1.65), 36mo £938 (×2.35).
  Prices below the floor are raised and flagged in the UI.
- **No £500 excess on one-year cover.** £500 excess also stays limited to £3,000/£5,000
  claim limits (25%-of-limit guardrail).
- Matrix columns are internal: 750 = AutoCare Basic (£1,000 displayed), 2000 = Essential (£2,000),
  1250 = legacy/promo fallback. Elite £3,000 and Premium £5,000 are derived columns.
