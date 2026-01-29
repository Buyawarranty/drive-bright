

# Stripe Embedded Payment Integration Plan

## Overview
This plan implements embedded Stripe payments using the **Payment Element**, allowing customers to complete their payment directly on buyawarranty.co.uk without being redirected to Stripe's hosted checkout page. The user stays on your site throughout the entire checkout process.

## Current Flow vs New Flow

**Current Flow (Redirect-based)**
1. User clicks "Complete One-Time Payment" 
2. Browser redirects to Stripe's hosted checkout page
3. User enters card details on stripe.com
4. After payment, redirected back to /thank-you

**New Flow (Embedded)**
1. User clicks "Complete One-Time Payment"
2. Modal opens with embedded Stripe payment form
3. User enters card details directly on buyawarranty.co.uk
4. Payment processes in background
5. Success message → redirect to /thank-you

---

## Implementation Phases

### Phase 1: Dependencies & Secret Setup

**Add Stripe frontend packages:**
- `@stripe/stripe-js` - Stripe.js loader
- `@stripe/react-stripe-js` - React components for Stripe Elements

**Add Secret:**
- `STRIPE_PUBLISHABLE_KEY` - Required for frontend Stripe.js initialization (starts with `pk_`)
- This secret already exists in your plan.md but needs to be added to the project

---

### Phase 2: New Edge Function

**Create `create-payment-intent` edge function**

This function creates a PaymentIntent instead of a Checkout Session:

Key differences from `create-checkout`:
- Uses `stripe.paymentIntents.create()` instead of `stripe.checkout.sessions.create()`
- Returns `{ clientSecret, paymentIntentId }` instead of `{ url }`
- Stores all metadata (customer data, vehicle data, add-ons, pricing) on the PaymentIntent for webhook retrieval
- Performs same server-side price validation as current `create-checkout`

Metadata stored on PaymentIntent:
- Customer details (name, email, phone, address)
- Vehicle details (reg, make, model, year, mileage)
- Plan details (planId, paymentType, claimLimit, labourRate)
- Add-ons (breakdown, rental, wearTear, etc.)
- Discount codes and final amount

---

### Phase 3: Frontend Components

**1. StripeProvider.tsx**
- Wrapper component that initializes Stripe with publishable key
- Uses `loadStripe()` to initialize Stripe.js
- Wraps payment components with `<Elements>` provider
- Passes `clientSecret` and appearance options

**2. StripePaymentForm.tsx**
- Uses `useStripe()` and `useElements()` hooks
- Renders `<PaymentElement>` with British styling (GB locale)
- Handles `stripe.confirmPayment()` with proper error handling
- Loading states during payment processing
- Error display for declined cards, validation issues

**3. EmbeddedCheckoutModal.tsx**
- Dialog/Modal using existing Radix pattern
- Shows order summary (vehicle, plan, price, discounts)
- Contains the StripePaymentForm
- Exit confirmation if user tries to close mid-payment
- Success animation on payment completion
- Branded with BuyAWarranty styling and secure messaging

---

### Phase 4: Webhook Updates

**Update `stripe-webhook` to handle `payment_intent.succeeded`**

Current webhook handles:
- `checkout.session.completed`

Add handler for:
- `payment_intent.succeeded`

The new handler will:
1. Extract metadata from the PaymentIntent
2. Transform data to match existing `handle-successful-payment` format
3. Call `handle-successful-payment` with same data structure
4. Update live quote status if applicable
5. Fire server-side conversion tracking

---

### Phase 5: StreamlinedCheckout Integration

**Modify `processStripeCheckout()` function:**

Replace redirect flow:
```
Current: → create-checkout → redirect to Stripe URL
New:     → create-payment-intent → open modal → confirm payment → /thank-you
```

Integration steps:
1. Call `create-payment-intent` to get `clientSecret`
2. Set state to show `EmbeddedCheckoutModal`
3. Modal opens with Stripe Payment Element
4. User enters card details inline
5. On successful confirmation, navigate to `/thank-you`
6. On failure, display error and allow retry

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/create-payment-intent/index.ts` | New edge function for Payment Intents |
| `src/components/stripe/StripeProvider.tsx` | Stripe Elements provider wrapper |
| `src/components/stripe/StripePaymentForm.tsx` | Payment Element form component |
| `src/components/stripe/EmbeddedCheckoutModal.tsx` | Modal container for embedded checkout |
| `src/components/stripe/index.ts` | Barrel export file |

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `@stripe/stripe-js`, `@stripe/react-stripe-js` |
| `supabase/functions/stripe-webhook/index.ts` | Add `payment_intent.succeeded` handler |
| `src/components/checkout/StreamlinedCheckout.tsx` | Replace redirect flow with embedded modal |

---

## Technical Details

### Payment Element Appearance

Themed to match BuyAWarranty brand:
- Orange accent colours (#E65100)
- Clean white backgrounds
- British formatting for card numbers
- Mobile-optimised inputs

### Error Handling

- Card declined → Display friendly message, allow retry
- Network issues → Retry button
- Validation errors → Inline field highlighting
- Timeout → Loading timeout with cancel option

### Security

- Payment confirmation happens via Stripe.js
- Customer card data never touches your servers
- Same webhook verification as current flow
- PCI DSS compliance maintained

---

## Backward Compatibility

- Bumper monthly payments continue to work exactly as-is (separate flow)
- Existing webhook handler for `checkout.session.completed` remains functional
- Can easily fall back to redirect flow if needed
- No changes to database schema required

---

## User Experience Flow

1. User fills in customer details on Step 4
2. User selects "Pay in full" option
3. User clicks "Complete One-Time Payment"
4. Modal opens with embedded Stripe payment form
5. Modal shows order summary (vehicle, plan, £amount)
6. User enters card details directly on buyawarranty.co.uk
7. User clicks "Pay £XXX now"
8. Loading spinner while processing
9. On success: Modal shows confirmation tick, then redirects to /thank-you
10. On failure: Error message displayed, user can retry

---

## Benefits

- **No redirect**: Customers stay on your site throughout checkout
- **Better conversion**: Fewer drop-offs from external redirects
- **Brand consistency**: Payment experience matches BuyAWarranty design
- **Mobile-friendly**: Works better on mobile without app switching
- **Faster**: No page loads to external domains
- **Trust**: Users see your branding, not a foreign site

