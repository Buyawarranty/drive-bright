---
name: Price updates are never retroactive
description: Publishing a new price model must never re-value existing sales, customer management records or customer portal policies
type: constraint
---

Publishing a new price model (admin → Price Updates) only affects NEW quotes and
new customer-journey sessions.

Hard rules:
- Existing sales keep the rate they were sold at. Never recompute a historic
  order's price from the current matrix.
- Customer Management and the customer login dashboard must read stored values
  (`final_amount`, `customer_policies.payment_amount`, stored excess / claim
  limit / labour rate). Never price these screens from `pricingMatrix`.
- Reports that need a retail baseline for past sales (e.g. Discounts Given) must
  price each record with the model that was live on its `signup_date` — use
  `withPricingAsOf()` from `src/lib/pricing/historicalPricing.ts`, backed by
  `pricing_matrix_versions.published_at`.
