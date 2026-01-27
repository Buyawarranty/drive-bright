
# Fix Boost Pricing for Multi-Year Plans

## Problem Identified

The upgrade from £2,000 to £3,000 claim limit on 2-year and 3-year plans is charging too much:

| Current Behavior | Expected Behavior |
|-----------------|-------------------|
| 2-year: £5/month × 24 months = £120 total | 2-year: £5/month × 12 months = £60 total |
| 3-year: £5/month × 36 months = £180 total | 3-year: £5/month × 12 months = £60 total |
| Price jumps from £98/month to £113/month (£15 difference) | Price should only increase by £5/month |

## Root Cause

The `calculateBoostAdjustment` function in `src/lib/pricingMatrix.ts` multiplies the £5/month boost price by the warranty duration, but all payments are always made over 12 months. This means the boost should always be £5/month × 12 = £60 total, regardless of cover length.

## Changes Required

### 1. Update Pricing Logic (src/lib/pricingMatrix.ts)

Modify `calculateBoostAdjustment` function to use a fixed 12-month multiplier instead of the duration:

```text
Current:
  durationMonths = DURATION_MONTHS[paymentPeriod];  // 12, 24, or 36
  return BOOST_CLAIM_LIMIT_MONTHLY * durationMonths;

Fixed:
  return BOOST_CLAIM_LIMIT_MONTHLY * 12;  // Always £60 total
```

Update the file comment to document this rule:
- Boost claim limit: +£5/month × 12 payments = £60 (same for all durations)

### 2. Remove "+£5/month" Label (src/components/step3/ClaimLimitSelector.tsx)

Remove lines 154-157 which display the upgrade price under the £3,000 option for multi-year plans:

```text
Remove:
  {isMultiYear && limit === 3000 && (
    <div className="text-xs text-primary font-medium mt-1">+£5/month</div>
  )}
```

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/pricingMatrix.ts` | Fix `calculateBoostAdjustment` to use fixed 12-month multiplier |
| `src/components/step3/ClaimLimitSelector.tsx` | Remove "+£5/month" label from £3,000 option |

### Pricing Propagation

Because this change is in the centralized `pricingMatrix.ts`, it will automatically propagate to:
- Step 3 (PricingTable.tsx)
- Step 4 (StreamlinedCheckout.tsx)
- Admin Dashboard (GetQuoteTab.tsx, ConfirmExternalPaymentTab.tsx)
- Email Quote functionality

### Expected Result

For a £2,000 base claim limit quote at £98/month:
- Selecting £3,000 will now show £103/month (£98 + £5)
- Total boost cost: £60 (£5 × 12 payments)
- Same pricing applies to both 2-year and 3-year plans
