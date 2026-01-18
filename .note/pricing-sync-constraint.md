# Pricing Sync Constraint: Step 3 ↔ Step 4 ↔ Admin Quotes & Orders

## Standing Rule (Permanent)

**Any pricing display logic changes made to Step 3 (PricingTable.tsx) MUST be automatically applied to:**
1. **Step 4 (StreamlinedCheckout.tsx)** - Customer checkout page
2. **Admin Quotes & Orders (GetQuoteTab.tsx, ConfirmExternalPaymentTab.tsx)**

## Key Sync Points

### Data Flow: Step 3 → Step 4
Step 3 passes pricing via `onPlanSelected` callback with this object:
```typescript
{
  totalPrice: displayTotalPrice,      // Raw total from pricing matrix + adjustments
  monthlyPrice: displayMonthlyPrice,  // Math.floor(totalPrice / 12) - CRITICAL!
  voluntaryExcess,
  claimLimit,
  labourRate,
  boostAddon,
  protectionAddOns
}
```

Step 4 MUST use `monthlyPrice` from Step 3 as the source of truth, NOT recalculate.

### Display Logic
- Monthly price: Use `monthlyPrice` from Step 3 (already floored)
- Total for monthly: `monthlyPrice * 12` (NOT raw `totalPrice`)
- Pay in full: `Math.floor(bumperTotalPrice * 0.90)` (10% discount)
- Both must use identical rounding and calculation methods

### Shared Dependencies
All pricing flows use centralized utilities from:
- `src/lib/pricingMatrix.ts` - Base prices, labour rate adjustments, boost adjustments
- `src/lib/addOnsUtils.ts` - Add-on pricing and auto-inclusion logic
- `src/lib/vehicleValidation.ts` - Vehicle price adjustments (mileage surcharges, etc.)

### Labour Rate Logic (£70/hr = Base)
- £50/hr: -£5/month
- £70/hr: £0 (base rate)
- £100/hr: +£8/month
- £200/hr: +£24/month

### When Updating Pricing
1. Make changes to centralized utilities first (pricingMatrix.ts, addOnsUtils.ts)
2. Verify Step 3 displays correctly
3. Verify Step 4 displays the EXACT same values as Step 3
4. Verify Admin Quotes & Orders displays the same values
5. All should show identical prices for identical configurations

## Files to Check for Parity
- `src/components/PricingTable.tsx` (Step 3 - SOURCE OF TRUTH)
- `src/components/checkout/StreamlinedCheckout.tsx` (Step 4 - must match Step 3)
- `src/components/admin/GetQuoteTab.tsx` (Admin quotes)
- `src/components/admin/ConfirmExternalPaymentTab.tsx` (Admin payment confirmation)
- `src/lib/pricingMatrix.ts` (Centralized pricing)

