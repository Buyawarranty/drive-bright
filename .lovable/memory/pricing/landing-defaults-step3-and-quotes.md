---
name: Step 3 & Quotes landing defaults
description: Customers on Step 3 and agents on Quotes & Orders always land on 2-year cover, £2,000 claim limit, £100 excess, £70/hr labour
type: feature
---
Landing state on BOTH the customer journey Step 3 and admin Quotes & Orders must be:
- 2-year cover (`24months`)
- £2,000 claim limit
- £100 voluntary excess
- £70/hr labour rate

No vehicle-price-based excess default (the old "£150 if baseline warranty ≥ £500" rule is retired). `getDefaultVoluntaryExcess` always returns 100.
