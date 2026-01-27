

# Embedded Stripe Payment Integration

## Overview
This plan implements Stripe's embedded checkout experience using **Stripe Payment Element**, allowing customers to complete payments directly on buyawarranty.co.uk without being redirected to Stripe's hosted checkout page.

## Current State
- **Current Flow**: Users click "Complete checkout" → Redirected to Stripe's hosted checkout page → After payment, redirected back to `/thank-you`
- **Current Functions**: `create-checkout` creates a Stripe Checkout Session with `mode: "payment"` and returns a redirect URL
- **Webhook**: `stripe-webhook` listens for `checkout.session.completed` and processes the payment via `handle-successful-payment`

## Proposed Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    CURRENT FLOW (Redirect)                       │
├─────────────────────────────────────────────────────────────────┤
│  User clicks Pay → create-checkout → Stripe Redirect → Thank You│
└─────────────────────────────────────────────────────────────────┘

                              ↓ BECOMES ↓

┌─────────────────────────────────────────────────────────────────┐
│                    NEW FLOW (Embedded)                           │
├─────────────────────────────────────────────────────────────────┤
│  User clicks Pay → create-payment-intent → Modal with Stripe    │
│  Payment Element → Confirm Payment → Webhook → Thank You        │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Dependencies & Setup

1. **Add Stripe.js to frontend**
   - Install `@stripe/stripe-js` and `@stripe/react-stripe-js` packages
   - Create a `StripeProvider` wrapper component

### Phase 2: New Edge Function

2. **Create `create-payment-intent` edge function**
   - Creates a Stripe PaymentIntent instead of Checkout Session
   - Returns the `client_secret` for frontend use
   - Stores all metadata (customer data, vehicle data, add-ons, pricing) in the PaymentIntent
   - Performs same server-side price validation as current `create-checkout`

### Phase 3: Frontend Components

3. **Create `StripePaymentForm` component**
   - Wraps Stripe's `PaymentElement`
   - Handles payment confirmation
   - Shows loading states and error handling
   - Matches existing Step 4 UX styling

4. **Create `EmbeddedCheckoutModal` component**
   - Modal that appears on Step 4 when user clicks "Pay in full"
   - Contains the `StripePaymentForm`
   - Provides clear branding (BuyAWarranty logo, secure payment messaging)
   - Exit confirmation dialog if user tries to close mid-payment

### Phase 4: Webhook Updates

5. **Update `stripe-webhook` to handle `payment_intent.succeeded`**
   - Currently handles `checkout.session.completed`
   - Add handler for `payment_intent.succeeded` event
   - Extract metadata from PaymentIntent
   - Call `handle-successful-payment` with the same data structure

### Phase 5: Integration

6. **Update `StreamlinedCheckout.tsx`**
   - Replace `processStripeCheckout` redirect flow with embedded modal flow
   - When user clicks "Complete One-Time Payment":
     - Call `create-payment-intent` to get client_secret
     - Open modal with embedded Stripe Payment Element
     - On successful payment, navigate to `/thank-you`

---

## Technical Details

### New Edge Function: `create-payment-intent`

```typescript
// Key differences from create-checkout:
// - Uses stripe.paymentIntents.create() instead of stripe.checkout.sessions.create()
// - Returns { clientSecret, paymentIntentId } instead of { url }
// - All metadata stored on PaymentIntent for webhook retrieval
```

### Frontend Components

**StripeProvider.tsx**
- Initializes Stripe with publishable key
- Wraps payment components with Elements provider

**StripePaymentForm.tsx**
- Uses `useStripe()` and `useElements()` hooks
- Renders `PaymentElement` with British styling
- Handles `stripe.confirmPayment()` with proper error handling

**EmbeddedCheckoutModal.tsx**
- Modal using existing Radix Dialog pattern
- Shows order summary (vehicle, plan, price)
- Contains StripePaymentForm
- Loading state during payment processing
- Success/error state handling

### Webhook Handler Updates

```typescript
// Add to stripe-webhook/index.ts:
if (event.type === "payment_intent.succeeded") {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  // Extract metadata and process same as checkout.session.completed
}
```

---

## Secret Required

**STRIPE_PUBLISHABLE_KEY**: Required for frontend Stripe.js initialization
- Currently only `STRIPE_SECRET_KEY` exists in secrets
- Need to add the publishable key (starts with `pk_`)

---

## UX Flow

1. User fills in customer details on Step 4
2. User selects "Pay in full" option
3. User clicks "Complete One-Time Payment"
4. Modal opens with embedded Stripe payment form
5. User enters card details directly on buyawarranty.co.uk
6. Payment processes in the background
7. On success: Modal shows confirmation, then redirects to /thank-you
8. On failure: Error message displayed, user can retry

---

## Benefits

- **No redirect**: Customers stay on your site throughout checkout
- **Better conversion**: Fewer drop-offs from external redirects
- **Brand consistency**: Payment experience matches BuyAWarranty design
- **Mobile-friendly**: Works better on mobile without app switching
- **Faster**: No page loads to external domains

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/create-payment-intent/index.ts` | New edge function for Payment Intents |
| `src/components/stripe/StripeProvider.tsx` | Stripe Elements provider wrapper |
| `src/components/stripe/StripePaymentForm.tsx` | Payment Element form component |
| `src/components/stripe/EmbeddedCheckoutModal.tsx` | Modal container for embedded checkout |

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@stripe/stripe-js`, `@stripe/react-stripe-js` |
| `supabase/functions/stripe-webhook/index.ts` | Add `payment_intent.succeeded` handler |
| `src/components/checkout/StreamlinedCheckout.tsx` | Integrate embedded checkout flow |

---

## Backward Compatibility

- Bumper monthly payments continue to work as-is (separate flow)
- Existing webhook handler for `checkout.session.completed` remains functional
- Can easily fall back to redirect flow if embedded fails

