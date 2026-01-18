# Pricing Sync Constraint: Step 3 ↔ Admin Quotes & Orders

## Standing Rule (Permanent)

**Any pricing display logic changes made to Step 3 (PricingTable.tsx) MUST be automatically applied to the admin Quotes & Orders section (GetQuoteTab.tsx and ConfirmExternalPaymentTab.tsx).**

## Key Sync Points

### Display Logic
- Total price display: `monthlyPrice * 12` (not raw `totalPrice`)
- Monthly price: `Math.floor(totalPrice / 12)`
- Both must use identical rounding and calculation methods

### Shared Dependencies
Both Step 3 and Admin use centralized utilities from:
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
3. Verify Admin Quotes & Orders displays the same values
4. Both should show identical prices for identical configurations

## Files to Check for Parity
- `src/components/PricingTable.tsx` (Step 3)
- `src/components/admin/GetQuoteTab.tsx` (Admin quotes)
- `src/components/admin/ConfirmExternalPaymentTab.tsx` (Admin payment confirmation)
- `src/lib/pricingMatrix.ts` (Centralized pricing)
