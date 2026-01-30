
# uChat WhatsApp Integration Implementation

## Webhook URL Received
The uChat webhook URL has been provided:
`https://www.uchat.com.au/api/iwh/cc070b383e47c30ea831c93ed24aa7ba`

## Implementation Steps

### Step 1: Add Secret
Add the `UCHAT_WEBHOOK_URL` secret to Supabase with the provided webhook URL.

### Step 2: Create Database Table
Create the `whatsapp_message_log` table for tracking messages and deduplication:

```sql
CREATE TABLE public.whatsapp_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  abandoned_cart_id UUID REFERENCES public.abandoned_carts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'welcome',
  status TEXT NOT NULL DEFAULT 'pending',
  uchat_response JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for deduplication checks
CREATE INDEX idx_whatsapp_log_phone_type ON public.whatsapp_message_log(normalized_phone, message_type, status);
CREATE INDEX idx_whatsapp_log_created ON public.whatsapp_message_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admin users can view whatsapp logs" ON public.whatsapp_message_log
  FOR SELECT USING (public.is_admin(auth.uid()));
```

### Step 3: Create Edge Function
Create `supabase/functions/send-uchat-whatsapp/index.ts`:

- Accept lead data (phone, firstName, vehicleMake, vehicleModel)
- Normalize UK phone numbers to international format (+44...)
- Check for existing welcome message in last 7 days (deduplication)
- POST to uChat webhook with lead data
- Log result to `whatsapp_message_log` table

### Step 4: Update track-abandoned-cart
Modify `supabase/functions/track-abandoned-cart/index.ts` to trigger WhatsApp welcome message when:
- Phone number is provided
- This is a new cart entry (not an update)

The trigger will call the `send-uchat-whatsapp` function asynchronously so it doesn't block the cart tracking.

## Technical Details

### Phone Number Normalization
```text
07xxx → +447xxx
0xxx  → +44xxx
44xxx → +44xxx
```

### Deduplication Logic
- Query `whatsapp_message_log` for matching `normalized_phone`
- Check for `message_type = 'welcome'` and `status = 'sent'`
- Only within last 7 days
- Skip sending if match found

### uChat Webhook Payload
```json
{
  "phone": "+447123456789",
  "firstName": "John",
  "vehicleMake": "BMW",
  "vehicleModel": "3 Series"
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create `whatsapp_message_log` table |
| `supabase/functions/send-uchat-whatsapp/index.ts` | Create new edge function |
| `supabase/functions/track-abandoned-cart/index.ts` | Add WhatsApp trigger |

## After Implementation - Your uChat Setup

Once implemented, configure uChat to handle the incoming webhook data:

1. **In uChat Flow Builder**: Create a flow triggered by the inbound webhook
2. **Map fields**: `{{phone}}`, `{{firstName}}`, `{{vehicleMake}}`, `{{vehicleModel}}`
3. **Send WhatsApp template** with the welcome message using dynamic variables

The welcome message template in uChat should use:
```
Hey {{firstName}},

Welcome to Buy A Warranty 🚗

Great news! You're just minutes away from securing reliable vehicle cover...

Kind regards,
James Reed
```
