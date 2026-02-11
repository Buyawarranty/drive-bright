
## Accept +91 (Indian) Phone Numbers in Step 2

### What Changes

**1. `src/components/QuoteDeliveryStep.tsx` (line 56)**

Update the phone validation regex to also accept Indian mobile numbers (+91 followed by 10 digits):

```typescript
// Before
const isValidPhone = /^(?:(?:\+44\s?|0)7\d{9}|(?:\+44\s?|0)[1-9]\d{8,9})$/.test(phone.replace(/\s/g, ''));

// After
const isValidPhone = /^(?:(?:\+44\s?|0)7\d{9}|(?:\+44\s?|0)[1-9]\d{8,9}|\+91[6-9]\d{9})$/.test(phone.replace(/\s/g, ''));
```

This accepts numbers like `+918076411880`, `+919876543210`, etc. (Indian mobiles start with 6-9 after the country code).

**2. `supabase/functions/send-uchat-whatsapp/index.ts`**

The normalizer already has the international pass-through from the previous change, so +91 numbers will flow through correctly to uChat without being mangled into +44 format. No further backend changes needed.

### Summary
- One-line regex update to allow +91 numbers alongside existing UK validation
- No changes to pricing, payment, or other logic
