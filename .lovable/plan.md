
# Fix uChat Webhook Payload to Match Your Inbound Webhook Setup

## What's Happening Now

Your uChat Inbound Webhook ("Webhook BAW") expects this JSON format for user matching:

```text
{
  "user_ns": "",
  "phone": "",
  "email": ""
}
```

But our edge function currently sends:

```text
{
  "phone": "+447...",
  "firstName": "John",
  "vehicleMake": "BMW",
  "vehicleModel": "3 Series"
}
```

The `phone` field matches, but `email` is missing -- uChat needs it as a fallback to identify the user. Also, `firstName`, `vehicleMake`, and `vehicleModel` should still be sent so you can use them as custom variables in your uChat flow.

## Changes

### 1. Update `send-uchat-whatsapp` Edge Function

**File:** `supabase/functions/send-uchat-whatsapp/index.ts`

- Add `email` to the `WhatsAppMessageRequest` interface
- Update the uChat payload to include `phone`, `email`, plus custom fields (`firstName`, `vehicleMake`, `vehicleModel`) that your uChat flow can reference

Updated payload will be:
```text
{
  "phone": "+447123456789",
  "email": "user@example.com",
  "firstName": "John",
  "vehicleMake": "BMW",
  "vehicleModel": "3 Series"
}
```

This gives uChat both `phone` and `email` for user matching (via `$.phone` and `$.email`), plus extra fields for personalization.

### 2. Update `track-abandoned-cart` to Pass Email

**File:** `supabase/functions/track-abandoned-cart/index.ts`

- Add `email` to the WhatsApp payload sent from the abandoned cart trigger (it already has `cartData.email` available)

### 3. uChat Setup (Your Side)

After deployment, in your uChat Inbound Webhook:

1. **Phone** field: already mapped to `$.phone` -- correct
2. **Email** field: already mapped to `$.email` -- correct
3. For custom variables (`firstName`, `vehicleMake`, `vehicleModel`), add custom field mappings in uChat or use them in your flow via `$.firstName`, `$.vehicleMake`, `$.vehicleModel`
4. Click **"Listen to data payload"**, then test by submitting a form on your site to verify uChat receives the data

## Summary

Two small edge function updates to include `email` in the webhook payload, matching what uChat expects for user identification.
