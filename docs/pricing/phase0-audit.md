# Phase 0 — Pricing calculation audit (draft, nothing changed)

Date: 7 Aug 2026. Read-only inventory of every place a warranty price is computed today,
so Phase 2 (single service) removes duplication without silently moving numbers.

## 1. Surfaces that compute a price

| Surface | File | Assembly used |
|---|---|---|
| Website Step 3 (desktop) | `src/components/step3/Step3Desktop.tsx` | own inline formula |
| Website Step 3 (mobile) | `src/components/step3/Step3Mobile.tsx` | own inline formula |
| Step 3 plan cards / checkout hand-off | `src/components/PricingTable.tsx` | own inline formula (canonical-ish) |
| Duration step (legacy) | `src/components/WarrantyDurationStep.tsx` | **hardcoded Dec-2025 base table**, not the live grid |
| Special vehicle pricing | `src/components/SpecialVehiclePricing.tsx` | own adjustment path |
| Admin Quotes & Orders | `src/components/admin/GetQuoteTab.tsx` | `calculateAdminQuoteWarrantyPrice()` |
| Confirm external payment | `src/components/admin/ConfirmExternalPaymentTab.tsx` | `calculateAdminQuoteWarrantyPrice()` |
| Bulk pricing | `src/components/admin/BulkPricingTab.tsx` | own loop over the grid |
| Manual order entry | `src/components/admin/ManualOrderEntry.tsx` | manual figures typed by agent |
| Claim-limit tiers | `src/lib/claimLimitTiers.ts` | derives surcharge from grid |
| Server floor guard | `supabase/functions/_shared/price-floor.ts` | **its own** plan-based base price |
| New draft service | `src/lib/pricing/quotePricingService.ts` | composes the primitives (not wired in) |

So: **two** admin paths share one helper, **four+** customer paths each have their own
formula, and the edge-function floor guard has a third independent base price.

## 2. Divergences found (each one is a real price difference risk)

1. **Labour-rate uplift is encoded three different ways.**
   - `PricingTable.tsx`: annual £0 / £48 / £96 / £288 for £50/70/100/150.
   - `Step3Desktop.tsx`: monthly −5 / 0 / +8 / +24 × duration months (so £50/hr is a *discount*, not £0).
   - `Step3Mobile.tsx`: `calculateLabourRateAdjustment(...)` applied to the floored base.
   - `pricingMatrix.ts` also exposes multiplicative `LABOUR_RATE_FACTOR` (0.84/1.00/1.18/1.80) plus
     manager-editable live factors — used by the admin helper but not by the Step 3 components.
   Result: the same car and options can differ between mobile and desktop Step 3.

2. **Multi-year goodwill discount (−£100 / −£200) exists only in `PricingTable.tsx`.**
   Step 3 desktop/mobile and both admin paths do not subtract it.

3. **Legacy age/mileage surcharge double-counts the published factor model.**
   `calculateVehiclePriceAdjustment()` adds +£200/£400/£600 for 120k–150k miles and an age premium,
   while `getVehiclePriceFactor()` already multiplies for age and mileage. Both run on Step 3,
   Quotes & Orders and Confirm payment. `vehicleValidation.ts` partially guards this
   (`!factorModelLive` on the mileage branch) but the age branch is not guarded the same way.

4. **Rounding is inconsistent.** `Math.ceil` on totals in most places, `Math.round` in
   `WarrantyDurationStep.tsx` monthly, `Math.round(base * 0.9 * 100)/100` (pence!) in
   `ConfirmExternalPaymentTab.tsx`, `Math.ceil(monthly)*12` in `GetQuoteTab.tsx` — meaning the
   contract total is derived from the monthly figure there, but from the base elsewhere.

5. **Boost is a flat £60 in code but re-declared in ~20 files**, including 8 edge functions that
   re-derive display claim limits (`claimLimit + 1000`) independently.

6. **`WarrantyDurationStep.tsx` ignores the live grid entirely** (hardcoded Dec-2025 base prices),
   so any Price-updates publish does not reach it.

7. **Floors live in two places**: `MIN_BASE_PRICE_BY_PERIOD` (294/672/1008 pre-uplift) in the client
   and a separate server-side floor in `supabase/functions/_shared/price-floor.ts`.

## 3. Ordering differences

Even where the same primitives are used, the order differs:
- `PricingTable`: base → legacy adjustment → multi-year discount → floor → labour + boost + add-ons.
- `Step3Mobile`: base → brand discount → legacy adjustment → floor → labour + add-ons + claim surcharge.
- `Step3Desktop`: base → floor (inside one call) → labour × months → add-ons → card surcharge.
- `GetQuoteTab`: brand discount and floor inside `calculateAdminQuoteWarrantyPrice`, claim-limit
  surcharge folded into `addOnPrice`.

Order matters because the floor sits mid-chain; a discount applied after the floor can breach it.

## 4. What Phase 2 must therefore do

1. Adopt one canonical order (the draft service already implements it):
   grid × vehicle factor → brand discount → (legacy surcharge, to be removed) → multi-year discount
   → floor → labour → boost → add-ons → rounding.
2. Decide the labour model explicitly: additive annual uplift (Step 3 today) **or** multiplicative
   factor (admin today). They are not equivalent; the choice changes prices.
3. Decide whether the multi-year −£100/−£200 stays. Today it is a website-only advantage.
4. Remove the legacy age/mileage surcharge once the factor model is calibrated, in one commit,
   with a parity table before/after.
5. Bring `WarrantyDurationStep.tsx` onto the live grid or retire it.
6. Align the edge-function floor guard with the version-stored floors so a published version cannot
   be rejected by the server.

## 5. Verification harness

`Admin → Price updates → Pricing engine (draft)` renders the draft service's full breakdown for any
vehicle and option set, flags floor application and double charging, and stays out of live pricing.
Next step is a parity table in that tab: draft service vs each live surface for a fixed vehicle set.
