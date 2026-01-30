
# uChat WhatsApp Welcome Message Integration

## Overview
Implement automated WhatsApp welcome messages for new leads using uChat's Inbound Webhook feature. When a new lead is captured (either via `abandoned_carts` or `sales_leads`), the system will automatically send a personalized WhatsApp message through uChat.

## How uChat Inbound Webhooks Work
uChat's Inbound Webhook allows external systems to trigger WhatsApp messages by sending a POST request with lead data. The webhook:
1. Receives lead data (phone, name, etc.)
2. Creates or finds a user profile in uChat using the phone number
3. Triggers a flow that sends the WhatsApp template message

## Implementation Components

### 1. New Edge Function: `send-uchat-whatsapp`
Create a new Supabase Edge Function that sends lead data to uChat's inbound webhook.

```text
supabase/functions/send-uchat-whatsapp/index.ts
├── Accept lead data (phone, firstName, vehicleMake, vehicleModel, etc.)
├── Format phone number to international format (+44...)
├── Send POST request to uChat inbound webhook URL
├── Log success/failure to whatsapp_message_log table
└── Return response status
```

**Message Template:**
```
Hey {firstName},

Welcome to Buy A Warranty 🚗

Great news! You're just minutes away from securing reliable vehicle cover and protecting yourself against unexpected repair costs.

We're getting in touch regarding the quote you recently requested for your vehicle. If you have any questions or need any help in the meantime, simply reply to this WhatsApp message or email and we'll be happy to assist.

Thank you for choosing Buy A Warranty, we look forward to helping you get covered.

Kind regards,

James Reed
James.Reed@buyawarranty.co.uk
Buy A Warranty | UK Vehicle Warranty & Extended Cover 

📞 0800 494 7477
```

### 2. Database Migration
Create a table to log WhatsApp messages and track which leads have received welcome messages:

```text
whatsapp_message_log
├── id (UUID, primary key)
├── lead_id (UUID, nullable - for sales_leads)
├── abandoned_cart_id (UUID, nullable - for abandoned_carts)
├── phone (text)
├── normalized_phone (text)
├── message_type (text: 'welcome', 'follow_up', etc.)
├── status (text: 'sent', 'failed', 'pending')
├── uchat_response (jsonb)
├── error_message (text, nullable)
├── created_at (timestamptz)
```

### 3. Integration Points
Modify the `track-abandoned-cart` edge function to trigger the WhatsApp welcome message:

```text
track-abandoned-cart/index.ts
├── [Existing logic] Create/update abandoned cart
├── [NEW] Check if welcome message already sent for this phone
├── [NEW] If new lead with phone number → call send-uchat-whatsapp
└── [NEW] Log the message attempt
```

### 4. Required uChat Setup (User Action)
The user will need to configure uChat:

1. **Create Inbound Webhook in uChat**
   - Go to Flow Builder → Tools → Inbound Webhooks
   - Create new webhook named "BuyaWarranty New Lead"
   - Note the webhook URL (e.g., `https://app.uchat.com.au/webhook/abc123...`)

2. **Configure Webhook Fields**
   - Map `phone` field for user identification
   - Map `firstName`, `vehicleMake`, `vehicleModel` for personalization

3. **Create WhatsApp Template**
   - Submit template to Facebook/Meta for approval (required for initiating WhatsApp conversations)
   - Template must match the message format above

4. **Build Flow**
   - Create flow triggered by inbound webhook
   - Send the approved template message with dynamic variables

### 5. Required Secret
Add a new secret to Supabase for the uChat webhook URL:
- **Secret Name:** `UCHAT_WEBHOOK_URL`
- **Value:** The inbound webhook URL from uChat

## Architecture Flow

```text
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────┐
│   User fills    │────▶│  track-abandoned-cart │────▶│ abandoned_carts │
│   quote form    │     │    edge function      │     │     table       │
└─────────────────┘     └───────────────────────┘     └─────────────────┘
                                   │
                                   │ (if phone exists & no welcome sent)
                                   ▼
                        ┌───────────────────────┐
                        │  send-uchat-whatsapp  │
                        │    edge function      │
                        └───────────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────┐     ┌─────────────────┐
                        │   uChat Inbound       │────▶│   WhatsApp      │
                        │     Webhook           │     │   Message       │
                        └───────────────────────┘     └─────────────────┘
                                   │
                                   ▼
                        ┌───────────────────────┐
                        │ whatsapp_message_log  │
                        │       table           │
                        └───────────────────────┘
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/send-uchat-whatsapp/index.ts` | Create | New edge function to call uChat webhook |
| `supabase/functions/track-abandoned-cart/index.ts` | Modify | Add WhatsApp trigger after cart creation |
| Database migration | Create | Add `whatsapp_message_log` table |

## Technical Details

### Edge Function: send-uchat-whatsapp

```typescript
// Key logic:
// 1. Validate phone number exists
// 2. Format to international format (+44)
// 3. Check if welcome message already sent (dedupe)
// 4. POST to uChat webhook with:
//    - phone: normalized phone
//    - firstName: customer first name
//    - vehicleMake: vehicle make
//    - vehicleModel: vehicle model
// 5. Log result to whatsapp_message_log
```

### Integration in track-abandoned-cart

```typescript
// After successful cart insert/update:
if (cartData.phone && !existingWelcomeMessage) {
  await supabase.functions.invoke('send-uchat-whatsapp', {
    body: {
      phone: cartData.phone,
      firstName: cartData.full_name?.split(' ')[0] || 'there',
      vehicleMake: cartData.vehicle_make,
      vehicleModel: cartData.vehicle_model,
      abandonedCartId: cartId
    }
  });
}
```

## Deduplication Strategy
- Check `whatsapp_message_log` by `normalized_phone` before sending
- Only send if no 'welcome' message sent in last 7 days for this phone
- Prevents spam if user abandons cart multiple times

## Error Handling
- Log all attempts (success/failure) to `whatsapp_message_log`
- Don't fail the main cart tracking if WhatsApp fails
- Include retry logic with exponential backoff (optional future enhancement)

## User Setup Checklist
Before the integration works, the user must:
1. Set up uChat account with WhatsApp Cloud API connected
2. Create and approve WhatsApp message template via Meta Business
3. Create inbound webhook in uChat and configure field mappings
4. Build flow to send template message on webhook trigger
5. Add `UCHAT_WEBHOOK_URL` secret in Supabase

## Testing Plan
1. Add the uChat webhook URL secret
2. Submit a test quote form with a phone number
3. Verify WhatsApp message is received
4. Check `whatsapp_message_log` table for entry
5. Verify deduplication works (no duplicate messages)
