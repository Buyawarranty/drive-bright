

# Fix: Name Showing Email + Blank Vehicle Make/Model in uChat

## Problem 1: firstName Contains Email Address

When the Step 2 form is submitted in `QuoteDeliveryStep.tsx`, the abandoned cart is tracked with:

```text
full_name: email.trim()   // <-- Bug! Should use firstName
```

Then in `track-abandoned-cart`, this `full_name` is split to get `firstName`:

```text
firstName: cartData.full_name?.split(' ')[0]   // Returns the email!
```

**Fix:** Update `QuoteDeliveryStep.tsx` line 148 to use the actual `firstName` value instead of the email.

## Problem 2: vehicleMake and vehicleModel Are Blank

The console logs show that `vehicleData.make` and `vehicleData.model` are empty strings when Step 2 renders. This means the DVLA lookup either didn't find data or the values weren't populated for this registration.

The `QuoteDeliveryStep` passes `vehicleData?.make` and `vehicleData?.model` to `track-abandoned-cart`, which then passes them to `send-uchat-whatsapp` -- but since they're empty from the start, they arrive empty in uChat.

**Fix:** In the `track-abandoned-cart` edge function, when triggering the WhatsApp message, fall back to the values stored in the abandoned cart record (which may have been updated by a previous interaction) if the current values are empty. Also look up the vehicle data from `sales_leads` if available, since the DVLA data is stored there too.

## Changes

### 1. Fix `full_name` in `QuoteDeliveryStep.tsx`

**File:** `src/components/QuoteDeliveryStep.tsx`

On line 148, change:
```text
full_name: email.trim(),
```
to:
```text
full_name: firstName.trim() || email.trim(),
```

Wait -- line 64 already does this correctly for the skip flow. Only line 148 (the submit flow) has the bug. Fix line 148 to use `firstName.trim()` like line 64 does.

### 2. Fix WhatsApp payload in `track-abandoned-cart`

**File:** `supabase/functions/track-abandoned-cart/index.ts`

Update line 167 to use `firstName` properly:
```text
firstName: cartData.full_name?.split(' ')[0] || 'there',
```
This is already correct IF `full_name` is fixed upstream. But as a safety net, also add the user's explicit first name if the cart data has it parsed separately.

### 3. Handle empty vehicle make/model gracefully

**File:** `supabase/functions/track-abandoned-cart/index.ts`

When building the WhatsApp payload, if `vehicle_make` and `vehicle_model` are empty, try to look them up from the `sales_leads` table using the email address. This handles the case where the DVLA lookup didn't return data initially but may have been stored from a previous interaction.

## Technical Details

### File: `src/components/QuoteDeliveryStep.tsx`
- Line 148: Change `full_name: email.trim()` to `full_name: firstName.trim() || email.trim()`

### File: `supabase/functions/track-abandoned-cart/index.ts`
- After inserting the abandoned cart record, before triggering the WhatsApp message:
  - If `vehicle_make` or `vehicle_model` are empty, query `sales_leads` by email to get the stored vehicle data
  - Pass the resolved values to the WhatsApp payload
- Update the `firstName` derivation to prefer splitting `full_name` but fall back properly

### File: `supabase/functions/send-uchat-whatsapp/index.ts`
- No changes needed -- it already passes through whatever it receives

## Summary

Two fixes:
1. **QuoteDeliveryStep.tsx**: Use `firstName` (not email) as `full_name` when tracking abandoned cart on submit
2. **track-abandoned-cart**: Look up vehicle make/model from `sales_leads` if the values coming in are empty, so uChat gets actual vehicle details
