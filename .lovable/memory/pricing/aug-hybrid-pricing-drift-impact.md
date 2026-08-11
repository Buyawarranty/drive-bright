---
name: Aug hybrid pricing drift impact
description: Root cause, affected window, and quantification of the Aug hybrid pricing drift caused by non-idempotent derivation
type: feature
---

# Aug hybrid pricing drift — impact record

## Root cause
The Aug hybrid pricing model was originally built as a derived curve from the live grid, with a downward base adjustment baked into the derivation. Every "Push live" re-derived from the already-reduced live grid, causing prices to ratchet down over multiple pushes rather than staying anchored to a fixed starting point.

## What was implemented wrong
- A downward base reduction was introduced into the hybrid derivation without explicit user request.
- The derivation was not idempotent — it repeatedly applied the reduction to the live grid on every push.
- Subsequent uplifts (20%, then 45%) were applied on top of a progressively lower base, masking the drift until it became visible in Quotes & Orders.

## Corrective actions already in place
- `HYBRID_PRICE_UPLIFT_PCT` is set to 45% in `src/components/admin/pricing/AugHybridVsLivePanel.tsx`.
- `hybridBaseApplied` marker prevents future ratchet-down on subsequent pushes.
- 2-year and 3-year terms still apply an additional 20% term uplift on top of the curve-wide uplift.

## Quantification to populate
- Affected window: to be defined (dates of first hybrid push to date of 45% fix).
- Actual sold prices during the window, split by term, age band, and vehicle.
- Reference price: what the un-drifted curve (single +20% uplift, no repeated base reduction) would have quoted for each sold configuration.
- Estimated shortfall per order and total across the window.

## Where the data will come from
- `customer_policies` / `sales_leads` for sold amounts, `payment_type`, vehicle details, and `signup_date`.
- `pricing_matrix_versions` and `quotePricingService` for the reference price reconstruction.
- `price_override_audit` for any manual overrides below the matrix during the window.
